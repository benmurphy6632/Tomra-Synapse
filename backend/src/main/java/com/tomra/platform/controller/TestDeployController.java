/*

THIS IS A TEST CONTROLLER FOR SIMULATING MODEL DEPLOYMENTS
IT IS TEMPORARY FOR TESTING UNTIL THE GRAPHQL API IS IMPLEMENTED.

 */


package com.tomra.platform.controller;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tomra.platform.model.ActiveSessionEntity;
import com.tomra.platform.repository.ActiveSessionRepository;
import com.tomra.platform.service.ModelDeployedEvent;


@RestController
@RequestMapping("/test")
public class TestDeployController {

    /**
     * ApplicationEventPublisher is a Spring built-in that allows any component
     * to publish events to the Spring event system. We inject it here to
     * publish a ModelDeployedEvent when the endpoint is hit.
     */
    @Autowired
    private ApplicationEventPublisher eventPublisher;

    /**
     * Repository for storing and retrieving active session records.
     */
    @Autowired
    private ActiveSessionRepository activeSessionRepository;

    /**
     * POST /test/deploy
     *
     * Accepts a JSON body with modelName and canaryPercentage.
     * Generates a unique deploymentId (UUID) and publishes a ModelDeployedEvent.
     * The event is picked up by DeploymentEventListener which pushes the
     * DeploymentCommand to all connected edge devices.
     *
     * @param request JSON body containing modelName and canaryPercentage
     * @return confirmation message with the generated deploymentId
     */
    @PostMapping("/deploy")
    public String triggerDeployment(@RequestBody DeployRequest request) {
        String deploymentId = UUID.randomUUID().toString();

        System.err.println("========================================");
        System.err.println("[TestDeployController] Deployment triggered");
        System.err.println("  Model:      " + request.getModelName());
        System.err.println("  Canary:     " + request.getCanaryPercentage() + "%");
        System.err.println("  Deploy ID:  " + deploymentId);
        System.err.println("========================================");

        eventPublisher.publishEvent(
            new ModelDeployedEvent(this, request.getModelName(), request.getCanaryPercentage(), deploymentId)
        );

        return "Deployment triggered — ID: " + deploymentId;
    }

    /**
     * POST /test/start-session
     *
     * Called by the frontend Start Session button.
     * Creates and stores an active session in the database.
     *
     * Example JSON:
     * {
     *   "projectId": "project-123",
     *   "stableModel": "model-a",
     *   "canaryModel": "model-b",
     *   "stablePercent": 70,
     *   "canaryPercent": 30
     * }
     */
    @PostMapping("/start-session")
    public ActiveSessionEntity startSession(@RequestBody StartSessionRequest request) {
        String sessionId = "sess-" + UUID.randomUUID();

        System.err.println("========================================");
        System.err.println("[StartSession] New session started");
        System.err.println("  Project:     " + request.getProjectId());
        System.err.println("  Stable:      " + request.getStableModel());
        System.err.println("  Canary:      " + request.getCanaryModel());
        System.err.println("  Split:       " + request.getStablePercent() + "/" + request.getCanaryPercent());
        System.err.println("  Session ID:  " + sessionId);
        System.err.println("========================================");

        ActiveSessionEntity session = new ActiveSessionEntity();
        session.setSessionId(sessionId);
        session.setProjectId(request.getProjectId());
        session.setStableModel(request.getStableModel());
        session.setCanaryModel(request.getCanaryModel());
        session.setStablePercent(request.getStablePercent());
        session.setCanaryPercent(request.getCanaryPercent());
        session.setStatus("ACTIVE");

        return activeSessionRepository.save(session);
    }

    /**
     * DeployRequest
     *
     * Simple inner class representing the JSON body of the POST request.
     * Spring automatically deserializes the JSON into this object.
     *
     * Example JSON:
     * {
     *   "modelName": "resnet101",
     *   "canaryPercentage": 10
     * }
     */
    public static class DeployRequest {
        private String modelName;
        private int canaryPercentage;

        public String getModelName() { return modelName; }
        public void setModelName(String modelName) { this.modelName = modelName; }
        public int getCanaryPercentage() { return canaryPercentage; }
        public void setCanaryPercentage(int canaryPercentage) { this.canaryPercentage = canaryPercentage; }
    }

    /**
     * StartSessionRequest
     *
     * Represents the JSON sent from the frontend Start Session button.
     */
    public static class StartSessionRequest {
        private String projectId;
        private String stableModel;
        private String canaryModel;
        private int stablePercent;
        private int canaryPercent;

        public String getProjectId() { return projectId; }
        public void setProjectId(String projectId) { this.projectId = projectId; }

        public String getStableModel() { return stableModel; }
        public void setStableModel(String stableModel) { this.stableModel = stableModel; }

        public String getCanaryModel() { return canaryModel; }
        public void setCanaryModel(String canaryModel) { this.canaryModel = canaryModel; }

        public int getStablePercent() { return stablePercent; }
        public void setStablePercent(int stablePercent) { this.stablePercent = stablePercent; }

        public int getCanaryPercent() { return canaryPercent; }
        public void setCanaryPercent(int canaryPercent) { this.canaryPercent = canaryPercent; }
    }
}