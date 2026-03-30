package com.tomra.platform.service;

import org.springframework.context.ApplicationEvent;

// only job is to carry data so Spring can pass them between components when the event fires.

/**
 * ModelDeployedEvent
 *
 * This is a Spring Application Event. It is the mechanism by which the
 * GraphQL mutation (triggered by the ML Engineer in the frontend) communicates
 * with the gRPC server to push a deployment down to the edge.
 *
 * How Spring Application Events work:
 * - Any Spring component can publish an event using ApplicationEventPublisher
 * - Any Spring component can listen for an event using @EventListener
 * - This decouples the GraphQL layer from the gRPC layer — neither needs
 *   a direct reference to the other
 *
 * Flow:
 * 1. ML Engineer triggers deployment in the frontend
 * 2. GraphQL mutation receives the request
 * 3. GraphQL mutation publishes a ModelDeployedEvent
 * 4. DeploymentEventListener picks up the event
 * 5. DeploymentEventListener calls pushDeploymentToAllEdges on the gRPC server
 * 6. gRPC server writes the DeploymentCommand to all open edge streams
 *
 * This matches the "Model deployed" Spring Application Event already shown
 * in the system architecture diagram.
 */
public class ModelDeployedEvent extends ApplicationEvent {

    /**
     * The name of the model to deploy e.g. "resnet101".
     * Passed through to the DeploymentCommand sent to the edge.
     */
    private final String modelName;

    /**
     * The canary percentage specified by the ML Engineer e.g. 10.
     * Passed through to the DeploymentCommand sent to the edge.
     */
    private final int canaryPercentage;

    /**
     * A unique ID for this deployment (UUID generated at trigger time).
     * Allows the edge acknowledgement to be matched back to this deployment.
     */
    private final String deploymentId;

    /**
     * Constructor.
     *
     * @param source           The object that published this event (typically the GraphQL resolver)
     * @param modelName        The model to deploy e.g. "resnet101"
     * @param canaryPercentage Percentage of traffic to route to the new model
     * @param deploymentId     Unique ID for this deployment
     */
    public ModelDeployedEvent(Object source, String modelName, int canaryPercentage, String deploymentId) {
        super(source);
        this.modelName = modelName;
        this.canaryPercentage = canaryPercentage;
        this.deploymentId = deploymentId;
    }

    public String getModelName() { return modelName; }
    public int getCanaryPercentage() { return canaryPercentage; }
    public String getDeploymentId() { return deploymentId; }
}