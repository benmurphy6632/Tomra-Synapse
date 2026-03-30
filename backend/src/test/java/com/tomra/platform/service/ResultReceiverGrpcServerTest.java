package com.tomra.platform.service;


import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.tomra.platform.grpc.Acknowledgement;
import com.tomra.platform.grpc.ClassificationResult;
import com.tomra.platform.grpc.DeploymentAcknowledgement;
import com.tomra.platform.grpc.EdgeDeviceRegistration;
import com.tomra.platform.model.ClassificationResultEntity;
import com.tomra.platform.model.ModelDeploymentEntity;
import com.tomra.platform.repository.ClassificationResultRepository;
import com.tomra.platform.repository.ModelDeploymentRepository;

import io.grpc.stub.StreamObserver;

class ResultReceiverGrpcServerTest {

    private ClassificationResultRepository classificationRepository;
    private ModelDeploymentRepository deploymentRepository;
    private ResultReceiverGrpcServer grpcServer;

    @BeforeEach
    void setUp() throws Exception {
        classificationRepository = mock(ClassificationResultRepository.class);
        deploymentRepository = mock(ModelDeploymentRepository.class);

        grpcServer = new ResultReceiverGrpcServer();

        // Inject mocked repositories via reflection — avoids starting Spring context
        // and avoids binding to port 9090
        var classificationField = ResultReceiverGrpcServer.class
                .getDeclaredField("classificationRepository");
        classificationField.setAccessible(true);
        classificationField.set(grpcServer, classificationRepository);

        var deploymentField = ResultReceiverGrpcServer.class
                .getDeclaredField("deploymentRepository");
        deploymentField.setAccessible(true);
        deploymentField.set(grpcServer, deploymentRepository);

        // Deliberately do NOT call grpcServer.start() — we don't want to bind port 9090
    }

    // ── submitResult ─────────────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void submitResult_savesEntityToRepository() {
        ClassificationResult request = ClassificationResult.newBuilder()
                .setID("device-1")
                .setImageName("orange.jpg")
                .setPredictedLabel("orange")
                .setConfidence(0.95f)
                .setModel("resnet50")
                .setClassID(950)
                .setLatency(0.12)
                .setImageUrl("https://example.com/orange.jpg")
                .setPowerUsage(15.0f)
                .setCo2Emissions(0.001f)
                .build();

        StreamObserver<Acknowledgement> responseObserver = mock(StreamObserver.class);

        grpcServer.submitResult(request, responseObserver);

        verify(classificationRepository, times(1)).save(any(ClassificationResultEntity.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void submitResult_sendsAcknowledgementToObserver() {
        ClassificationResult request = ClassificationResult.newBuilder()
                .setID("device-1")
                .setImageName("orange.jpg")
                .setPredictedLabel("orange")
                .setConfidence(0.95f)
                .setModel("resnet50")
                .setClassID(950)
                .setLatency(0.12)
                .setImageUrl("")
                .setPowerUsage(15.0f)
                .setCo2Emissions(0.001f)
                .build();

        StreamObserver<Acknowledgement> responseObserver = mock(StreamObserver.class);

        grpcServer.submitResult(request, responseObserver);

        verify(responseObserver, times(1)).onNext(any(Acknowledgement.class));
        verify(responseObserver, times(1)).onCompleted();
    }

    // ── subscribeToDeployments ────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void subscribeToDeployments_doesNotReplayCommand_whenNoActiveDeployment() {
        //when(deploymentRepository.findByActive(true)).thenReturn(Optional.empty());
        when(deploymentRepository.findByStatusIn(List.of(1, 2))).thenReturn(List.of());

        EdgeDeviceRegistration request = EdgeDeviceRegistration.newBuilder()
                .setDeviceId("edge-1")
                .build();

        StreamObserver responseObserver = mock(StreamObserver.class);

        grpcServer.subscribeToDeployments(request, responseObserver);

        // No active deployment — should not push anything to the stream
        verify(responseObserver, never()).onNext(any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void subscribeToDeployments_replaysActiveDeployment_whenOneExists() {
        ModelDeploymentEntity activeDeployment = new ModelDeploymentEntity();
        activeDeployment.setModelName("resnet101");
        activeDeployment.setCanaryPercentage(10);
        activeDeployment.setDeploymentId("deploy-123");
        //activeDeployment.setActive(true);

        //(deploymentRepository.findByActive(true)).thenReturn(Optional.of(activeDeployment));
        activeDeployment.setStatus(1);
        when(deploymentRepository.findByStatusIn(List.of(1, 2))).thenReturn(List.of(activeDeployment));

        EdgeDeviceRegistration request = EdgeDeviceRegistration.newBuilder()
                .setDeviceId("edge-1")
                .build();

        StreamObserver responseObserver = mock(StreamObserver.class);

        grpcServer.subscribeToDeployments(request, responseObserver);

        // Active deployment exists — should replay it immediately to the reconnecting
        // edge
        verify(responseObserver, times(1)).onNext(any());
    }

    // ── acknowledgeDeployment ─────────────────────────────────────────────────

    @Test
    @SuppressWarnings("unchecked")
    void acknowledgeDeployment_sendsAcknowledgementToObserver() {
        DeploymentAcknowledgement request = DeploymentAcknowledgement.newBuilder()
                .setDeviceId("edge-1")
                .setDeploymentId("deploy-123")
                .setLoadedModel("resnet101")
                .setSuccess(true)
                .setMessage("Model loaded successfully")
                .build();

        StreamObserver<Acknowledgement> responseObserver = mock(StreamObserver.class);

        grpcServer.acknowledgeDeployment(request, responseObserver);

        verify(responseObserver, times(1)).onNext(any(Acknowledgement.class));
        verify(responseObserver, times(1)).onCompleted();
    }

    // ── pushDeploymentToAllEdges ──────────────────────────────────────────────

    @Test
    void pushDeploymentToAllEdges_savesNewDeploymentAsActive() {
        //when(deploymentRepository.findByActive(true)).thenReturn(Optional.empty());
        when(deploymentRepository.findByStatusIn(List.of(1, 2))).thenReturn(List.of());

        grpcServer.pushDeploymentToAllEdges("resnet101", 10, "deploy-123");

        verify(deploymentRepository, times(1)).save(any(ModelDeploymentEntity.class));
    }

    @Test
    void pushDeploymentToAllEdges_deactivatesPreviousDeployment_whenOneExists() {
        ModelDeploymentEntity existing = new ModelDeploymentEntity();
        //existing.setActive(true);
        existing.setModelName("resnet50");

        existing.setStatus(1);
        when(deploymentRepository.findByStatusIn(List.of(1, 2))).thenReturn(List.of(existing));

        //when(deploymentRepository.findByActive(true)).thenReturn(Optional.of(existing));

        grpcServer.pushDeploymentToAllEdges("resnet101", 10, "deploy-456");

        // Should save the deactivated old deployment + the new active one = 2 saves
        verify(deploymentRepository, times(2)).save(any(ModelDeploymentEntity.class));
    }
}