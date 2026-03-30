package com.tomra.platform.service;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * DeploymentEventListener
 *
 * This class listens for ModelDeployedEvents published by the GraphQL mutation
 * and forwards them to the gRPC server to be pushed down to connected edge devices.
 *
 * It is the bridge between the GraphQL layer and the gRPC layer.
 * This keeps the GraphQL mutation clean — it just publishes an event and
 * doesn't need to know anything about gRPC or edge devices.
 *
 * The @EventListener annotation tells Spring to call onModelDeployed()
 * automatically whenever a ModelDeployedEvent is published anywhere
 * in the application.
 */
@Service
public class DeploymentEventListener {

    /**
     * Reference to the gRPC server which holds the stream registry.
     * Injected via constructor — preferred over @Autowired for testability.
     */
    private final ResultReceiverGrpcServer grpcServer;

    public DeploymentEventListener(ResultReceiverGrpcServer grpcServer) {
        this.grpcServer = grpcServer;
    }

    /**
     * Called automatically by Spring when a ModelDeployedEvent is published.
     *
     * Extracts the deployment details from the event and calls
     * pushDeploymentToAllEdges on the gRPC server, which writes the
     * DeploymentCommand to every currently connected edge device's open stream.
     *
     * @param event The deployment event containing model name, canary percentage and deployment ID
     */
    @EventListener
    public void onModelDeployed(ModelDeployedEvent event) {
        System.err.println("========================================");
        System.err.println("[DeploymentEventListener] Deployment event received");
        System.err.println("  Model:      " + event.getModelName());
        System.err.println("  Canary:     " + event.getCanaryPercentage() + "%");
        System.err.println("  Deploy ID:  " + event.getDeploymentId());
        System.err.println("========================================");

        grpcServer.pushDeploymentToAllEdges(
            event.getModelName(),
            event.getCanaryPercentage(),
            event.getDeploymentId()
        );
    }
}