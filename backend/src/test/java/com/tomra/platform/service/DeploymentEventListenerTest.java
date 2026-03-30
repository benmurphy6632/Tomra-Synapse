package com.tomra.platform.service;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class DeploymentEventListenerTest {

    private ResultReceiverGrpcServer grpcServer;
    private DeploymentEventListener listener;

    @BeforeEach
    void setUp() {
        // Mock the gRPC server — we never want to start it on port 9090 in tests
        grpcServer = mock(ResultReceiverGrpcServer.class);
        listener = new DeploymentEventListener(grpcServer);
    }

    @Test
    void onModelDeployed_callsPushDeploymentToAllEdges() {
        ModelDeployedEvent event = new ModelDeployedEvent(this, "resnet101", 10, "deploy-123");

        listener.onModelDeployed(event);

        verify(grpcServer, times(1)).pushDeploymentToAllEdges("resnet101", 10, "deploy-123");
    }

    @Test
    void onModelDeployed_passesCorrectModelName() {
        ModelDeployedEvent event = new ModelDeployedEvent(this, "efficientnet-b0", 25, "deploy-456");

        listener.onModelDeployed(event);

        verify(grpcServer).pushDeploymentToAllEdges("efficientnet-b0", 25, "deploy-456");
    }

    @Test
    void onModelDeployed_passesCorrectCanaryPercentage() {
        ModelDeployedEvent event = new ModelDeployedEvent(this, "resnet50", 100, "deploy-789");

        listener.onModelDeployed(event);

        verify(grpcServer).pushDeploymentToAllEdges("resnet50", 100, "deploy-789");
    }

    @Test
    void onModelDeployed_passesCorrectDeploymentId() {
        ModelDeployedEvent event = new ModelDeployedEvent(this, "resnet50", 50, "unique-deploy-id");

        listener.onModelDeployed(event);

        verify(grpcServer).pushDeploymentToAllEdges("resnet50", 50, "unique-deploy-id");
    }
}