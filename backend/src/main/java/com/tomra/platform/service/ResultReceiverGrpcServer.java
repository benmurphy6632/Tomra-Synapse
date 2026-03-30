package com.tomra.platform.service;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.tomra.platform.dto.AvailableModel;
import com.tomra.platform.grpc.Acknowledgement;
import com.tomra.platform.grpc.AvailableModelsSyncRequest;
import com.tomra.platform.grpc.ClassificationResult;
import com.tomra.platform.grpc.DeploymentAcknowledgement;
import com.tomra.platform.grpc.DeploymentCommand;
import com.tomra.platform.grpc.EdgeDeviceRegistration;
import com.tomra.platform.grpc.JwtGrpcServerInterceptor;
import com.tomra.platform.grpc.ResultReceiverServiceGrpc;
import com.tomra.platform.model.ClassificationResultEntity;
import com.tomra.platform.model.ModelDeploymentEntity;
import com.tomra.platform.repository.ClassificationResultRepository;
import com.tomra.platform.repository.ModelDeploymentRepository;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * ResultReceiverGrpcServer
 *
 * Central gRPC server for the Tomra Synapse platform backend.
 * Runs on port 9090 and handles all communication between the
 * cloud backend and edge devices.
 *
 * Extends ResultReceiverServiceImplBase which is auto-generated from
 * result_receiver.proto by the protobuf Maven plugin at compile time.
 * Any RPC defined in the proto file appears as a method to override here.
 *
 * Handles three RPCs:
 *
 * 1. SubmitResult (existing, unchanged from Stage 1)
 * Edge pushes a classification result to cloud.
 * Direction: Edge → Cloud (unary)
 *
 * 2. SubscribeToDeployments (new, Stage 2)
 * Edge opens a persistent stream on startup and listens for
 * deployment commands pushed down from the cloud.
 * Direction: Cloud → Edge (server-streaming)
 *
 * 3. AcknowledgeDeployment (new, Stage 2)
 * Edge confirms it has successfully loaded a new model.
 * Direction: Edge → Cloud (unary)
 *
 *
 * Boolean active → int status: WHICH ARE DEFINED AS CONSTANTS BELOW:
 *  private static final int STATUS_ARCHIVED = 0;
 *  private static final int STATUS_CANARY   = 1;
 *  private static final int STATUS_STABLE   = 2;
 */
@Service
public class ResultReceiverGrpcServer extends ResultReceiverServiceGrpc.ResultReceiverServiceImplBase {

    private Server server;
    private static final int GRPC_PORT = 50051;

    private static final int STATUS_ARCHIVED = 0;
    private static final int STATUS_CANARY = 1;
    private static final int STATUS_STABLE = 2;

    /**
     * Stream registry — maps device ID to its open DeploymentCommand stream.
     *
     * ConcurrentHashMap is used instead of a regular HashMap because multiple
     * threads can access this simultaneously — one thread per connected edge
     * device plus the deployment event listener thread. ConcurrentHashMap
     * handles this safely without needing manual synchronization.
     *
     * When an edge connects: its stream is added to this map
     * When an edge disconnects: its stream is removed from this map
     * When a deployment triggers: we iterate this map and write to every stream
     */
    private final ConcurrentHashMap<String, StreamObserver<DeploymentCommand>> connectedEdges = new ConcurrentHashMap<>();

    @Autowired
    private ClassificationResultRepository classificationRepository;

    /**
     * Repository for deployment records in the H2 database.
     * Used to save new deployments and to replay the active deployment
     * to edge devices that reconnect after a restart.
     */
    @Autowired
    private ModelDeploymentRepository deploymentRepository;

    @Autowired
    private JwtGrpcServerInterceptor jwtGrpcServerInterceptor;

    @Autowired
    private AvailableModelStore availableModelStore;

    /**
     * Starts the gRPC server on port 9090 when the Spring application starts.
     *
     * @PostConstruct runs automatically after Spring has finished setting up
     *                the bean and injecting all dependencies.
     */
    @PostConstruct
    public void start() throws IOException {
        server = ServerBuilder.forPort(GRPC_PORT)
                .intercept(jwtGrpcServerInterceptor)
                .addService(this)
                .build()
                .start();

        System.err.println("========================================");
        System.err.println("[gRPC Server] Cloud listening for edge results on port " + GRPC_PORT);
        System.err.println("========================================");

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.err.println("[gRPC Server] Shutting down");
            ResultReceiverGrpcServer.this.stop();
        }));
    }

    /**
     * Shuts down the gRPC server cleanly when the Spring application stops.
     *
     * @PreDestroy runs automatically before the bean is destroyed.
     */
    @PreDestroy
    public void stop() {
        if (server != null) {
            server.shutdown();
            System.err.println("[gRPC Server] Stopped");
        }
    }

    /**
     * SubmitResult — handles incoming classification results from edge devices.
     *
     * Unary RPC — edge sends one ClassificationResult and receives one
     * Acknowledgement back. Stream is closed immediately after.
     *
     * Saves the result to the H2 database via classificationRepository
     * so it can be queried by the GraphQL API and shown in the dashboard.
     */
    @Override
    public void submitResult(ClassificationResult request, StreamObserver<Acknowledgement> responseObserver) {
        String deviceId = request.getID();
        String image = request.getImageName();
        String label = request.getPredictedLabel();
        double confidence = request.getConfidence();
        String model = request.getModel();
        int classId = request.getClassID();
        double latency = request.getLatency();
        String imageURL = request.getImageUrl();
        double powerUsage = request.getPowerUsage();
        double co2Emissions = request.getCo2Emissions();
        String projectId = request.getProjectId();

        System.err.println("========================================");
        System.err.println("[gRPC Server] Received classification from edge:");
        System.err.println("  Device ID:   " + deviceId);
        System.err.println("  Project ID:  " + projectId);
        System.err.println("  Image:       " + image);
        System.err.println("  Label:       " + label);
        System.err.println("  Confidence:  " + String.format("%.2f%%", confidence * 100));
        System.err.println("  Model:       " + model);
        System.err.println("  Class ID:    " + classId);
        System.err.println("  Latency:     " + latency);
        System.err.println("  Image URL:   " + imageURL);
        System.err.println("  Power Usage (W):       " + powerUsage);
        System.err.println("  CO2 Emissions (g):       " + co2Emissions);
        System.err.println("========================================");

        ClassificationResultEntity classificationEntity = new ClassificationResultEntity();
        classificationEntity.setProjectId(projectId);
        classificationEntity.setDeviceId(deviceId);
        classificationEntity.setImageName(image);
        classificationEntity.setPredictedLabel(label);
        classificationEntity.setConfidence(confidence);
        classificationEntity.setModel(model);
        classificationEntity.setClassId(classId);
        classificationEntity.setLatency(latency);
        classificationEntity.setImageURL(imageURL);
        classificationEntity.setPowerUsage(powerUsage);
        classificationEntity.setCO2Emissions(co2Emissions);

        classificationRepository.save(classificationEntity);

        Acknowledgement ack = Acknowledgement.newBuilder()
                .setReceived(true)
                .setMessage("Result received successfully by cloud")
                .build();

        responseObserver.onNext(ack);
        responseObserver.onCompleted();
    }

    /**
     * SubscribeToDeployments — edge device opens a persistent stream to receive
     * deployment commands from the cloud.
     *
     * Server-streaming RPC. Unlike SubmitResult, this stream stays open
     * indefinitely — we never call responseObserver.onCompleted(). The backend
     * writes DeploymentCommand messages to the stream whenever an ML Engineer
     * triggers a deployment from the frontend.
     *
     * On connection:
     * 1. The edge device's stream is registered in connectedEdges
     * 2. If there is already an active deployment in the database, it is
     * immediately replayed to this edge — handles the case where an edge
     * device restarts and reconnects mid-deployment
     */
    @Override
    public void subscribeToDeployments(
            EdgeDeviceRegistration request,
            StreamObserver<DeploymentCommand> responseObserver) {
        String deviceId = request.getDeviceId();

        System.err.println("========================================");
        System.err.println("[gRPC Server] Edge device subscribed to deployments: " + deviceId);
        System.err.println("========================================");

        connectedEdges.put(deviceId, responseObserver);

        List<ModelDeploymentEntity> activeDeployments = deploymentRepository
                .findByStatusIn(List.of(STATUS_CANARY, STATUS_STABLE));

        if (!activeDeployments.isEmpty()) {
            ModelDeploymentEntity deployment = activeDeployments.get(0);
            System.err.println("[gRPC Server] Replaying active deployment to edge: " + deviceId
                    + " (model: " + deployment.getModelName() + ")");

            DeploymentCommand command = DeploymentCommand.newBuilder()
                    .setModelName(deployment.getModelName())
                    .setCanaryPercentage(deployment.getCanaryPercentage())
                    .setDeploymentId(deployment.getDeploymentId())
                    .build();

            responseObserver.onNext(command);
        }

        // Intentionally do NOT call responseObserver.onCompleted() here.
    }

    /**
     * AcknowledgeDeployment — edge device confirms it has loaded a new model
     * after receiving a DeploymentCommand.
     *
     * Unary RPC — edge sends one DeploymentAcknowledgement and receives one
     * Acknowledgement back.
     */
    @Override
    public void acknowledgeDeployment(
            DeploymentAcknowledgement request,
            StreamObserver<Acknowledgement> responseObserver) {
        System.err.println("========================================");
        System.err.println("[gRPC Server] Deployment acknowledged by edge: " + request.getDeviceId());
        System.err.println("  Deployment ID: " + request.getDeploymentId());
        System.err.println("  Loaded model:  " + request.getLoadedModel());
        System.err.println("  Success:       " + request.getSuccess());
        System.err.println("  Message:       " + request.getMessage());
        System.err.println("========================================");

        Acknowledgement ack = Acknowledgement.newBuilder()
                .setReceived(true)
                .setMessage("Deployment acknowledgement received")
                .build();

        responseObserver.onNext(ack);
        responseObserver.onCompleted();
    }

    /**
     * SyncAvailableModels — edge device sends the list of currently available
     * model names to the backend.
     *
     * Unary RPC — edge sends one AvailableModelsSyncRequest and receives one
     * Acknowledgement back.
     *
     * For now, this only stores model names in memory so they can be exposed
     * through GraphQL to the frontend.
     */
    @Override
    public void syncAvailableModels(
            AvailableModelsSyncRequest request,
            StreamObserver<Acknowledgement> responseObserver) {
        String deviceId = request.getDeviceId();

        System.err.println("========================================");
        System.err.println("[gRPC Server] Available models synced from edge: " + deviceId);

        List<AvailableModel> models = request.getModelsList().stream()
                .map(model -> new AvailableModel(model.getName()))
                .toList();

        models.forEach(model -> System.err.println("  Model Name:   " + model.getName()));

        System.err.println("========================================");

        availableModelStore.setModels(models);

        Acknowledgement ack = Acknowledgement.newBuilder()
                .setReceived(true)
                .setMessage("Available models received successfully")
                .build();

        responseObserver.onNext(ack);
        responseObserver.onCompleted();
    }

    /**
     * pushDeploymentToAllEdges — writes a DeploymentCommand to every currently
     * connected edge device's open stream.
     *
     * Called by DeploymentEventListener when a ModelDeployedEvent fires.
     * This is an internal method, not a gRPC endpoint.
     *
     * Before pushing to edges:
     * 1. Any previously active deployment in the database is deactivated
     * 2. The new deployment is saved as active
     *
     * @param modelName        The model to deploy e.g. "resnet101"
     * @param canaryPercentage Percentage of traffic to route to the new model
     * @param deploymentId     Unique ID for this deployment
     */
    public void pushDeploymentToAllEdges(String modelName, int canaryPercentage, String deploymentId) {
        deploymentRepository.findByStatusIn(List.of(STATUS_CANARY, STATUS_STABLE))
                .forEach(existing -> {
                    existing.setStatus(STATUS_ARCHIVED);
                    deploymentRepository.save(existing);
                });

        ModelDeploymentEntity deployment = new ModelDeploymentEntity();
        deployment.setDeploymentId(deploymentId);
        deployment.setModelName(modelName);
        deployment.setCanaryPercentage(canaryPercentage);
        deployment.setStatus(STATUS_CANARY);
        deploymentRepository.save(deployment);

        DeploymentCommand command = DeploymentCommand.newBuilder()
                .setModelName(modelName)
                .setCanaryPercentage(canaryPercentage)
                .setDeploymentId(deploymentId)
                .build();

        System.err.println("[gRPC Server] Pushing deployment to "
                + connectedEdges.size() + " connected edge(s)");

        connectedEdges.forEach((deviceId, stream) -> {
            try {
                stream.onNext(command);
                System.err.println("[gRPC Server] Deployment pushed to edge: " + deviceId);
            } catch (Exception e) {
                System.err.println("[gRPC Server] Failed to push to edge: " + deviceId
                        + " — removing from registry. Error: " + e.getMessage());
                connectedEdges.remove(deviceId);
            }
        });
    }
}

// package com.tomra.platform.service;

// import java.io.IOException;

// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.stereotype.Service;

// import com.tomra.platform.grpc.Acknowledgement;
// import com.tomra.platform.grpc.ClassificationResult;
// import com.tomra.platform.grpc.ResultReceiverServiceGrpc;
// import com.tomra.platform.model.ClassificationResultEntity;
// import com.tomra.platform.repository.ClassificationResultRepository;

// import io.grpc.Server;
// import io.grpc.ServerBuilder;
// import io.grpc.stub.StreamObserver;
// import jakarta.annotation.PostConstruct;
// import jakarta.annotation.PreDestroy;

// @Service
// public class ResultReceiverGrpcServer extends
// ResultReceiverServiceGrpc.ResultReceiverServiceImplBase {

// private Server server;
// private static final int GRPC_PORT = 9090;

// @Autowired
// private ClassificationResultRepository classificationRepository;

// @PostConstruct
// public void start() throws IOException {
// server = ServerBuilder.forPort(GRPC_PORT)
// .addService(this)
// .build()
// .start();

// System.err.println("========================================");
// System.err.println("[gRPC Server] Cloud listening for edge results on port "
// + GRPC_PORT);
// System.err.println("========================================");

// Runtime.getRuntime().addShutdownHook(new Thread(() -> {
// System.err.println("[gRPC Server] Shutting down");
// ResultReceiverGrpcServer.this.stop();
// }));
// }

// @PreDestroy
// public void stop() {
// if (server != null) {
// server.shutdown();
// System.err.println("[gRPC Server] Stopped");
// }
// }

// @Override
// public void submitResult(ClassificationResult request,
// StreamObserver<Acknowledgement> responseObserver) {
// String deviceId = request.getID();
// String image = request.getImageName();
// String label = request.getPredictedLabel();
// double confidence = request.getConfidence();
// String model = request.getModel();
// int classId = request.getClassID();
// double latency = request.getLatency();
// String imageURL = request.getImageUrl();

// System.err.println("========================================");
// System.err.println("[gRPC Server] Received classification from edge:");
// System.err.println(" Device ID: " + deviceId);
// System.err.println(" Image: " + image);
// System.err.println(" Label: " + label);
// System.err.println(" Confidence: " + String.format("%.2f%%", confidence *
// 100));
// System.err.println(" Model: " + model);
// //System.err.println(" Filename: " + filename);
// System.err.println(" Class ID: " + classId);
// System.err.println(" Latency: " + latency);
// System.err.println(" Image URL: " + imageURL);
// //System.err.println(" Timestamp: " + request.getTimestamp()); -> optinal
// once again as in the .proto file, don't forget to change one or the other.
// System.err.println("========================================");

// // Add new Classification Entity
// ClassificationResultEntity classificationEntity = new
// ClassificationResultEntity();
// classificationEntity.setDeviceId(deviceId);
// classificationEntity.setImageName(image);
// classificationEntity.setPredictedLabel(label);
// classificationEntity.setConfidence(confidence);
// classificationEntity.setModel(model);
// //classificationEntity.setFilename(filename);
// classificationEntity.setClassId(classId);
// classificationEntity.setLatency(latency);
// classificationEntity.setImageURL(imageURL);

// classificationRepository.save(classificationEntity);

// Acknowledgement ack = Acknowledgement.newBuilder()
// .setReceived(true)
// .setMessage("Result received successfully by cloud")
// .build();

// responseObserver.onNext(ack);
// responseObserver.onCompleted();
// }
// }