package com.tomra.platform.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;


    /**
     * CHANGED FROM: private boolean active
     * The current status of this deployment.
     * Status values:
     * 0 = archived (superseded by a newer deployment)
     * 1 = canary   (currently rolling out, receiving a percentage of traffic)
     * 2 = stable   (fully deployed, 100% of traffic)
     */

/**
 * ModelDeploymentEntity
 *
 * JPA entity that maps to a table in the existing H2 database.
 * Hibernate creates the "model_deployment_entity" table automatically
 * on startup alongside the existing "classification_result_entity" table.
 * No additional database configuration is required.
 *
 * Note: the H2 database is in-memory (jdbc:h2:mem:testdb), so deployment
 * records are cleared on backend restart. This is consistent with how
 * classification results are currently handled.
 */
@Entity
public class ModelDeploymentEntity {

    /**
     * Auto-generated primary key for the database row.
     * Same pattern as ClassificationResultEntity.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * A unique string ID for this specific deployment.
     * Generated when the ML Engineer triggers a deployment (e.g. a UUID).
     * This is what the edge device references when it sends back an
     * AcknowledgeDeployment — so we can match the acknowledgement
     * to the exact deployment that triggered it.
     */
    private String deploymentId;

    /**
     * The name of the model to deploy e.g. "resnet101".
     * This is what the edge uses to load the correct model from torchvision.
     */
    private String modelName;

    /**
     * The percentage of traffic that should go to the new model.
     * Set by the ML Engineer in the frontend — e.g. 10 means 10% of images
     * will be classified by the new model, 90% by the existing one.
     * If the ML Engineer wants a full cutover they set this to 100.
     */
    private int canaryPercentage;

    /**
     * Whether this is the currently active deployment.
     * Only one deployment should be active at a time.
     * When a new deployment is triggered, the previous active one is
     * set to false and this new one is set to true.
     */
    private int status; // CHANGED FROM: private boolean active


    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeploymentId() { return deploymentId; }
    public void setDeploymentId(String deploymentId) { this.deploymentId = deploymentId; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public int getCanaryPercentage() { return canaryPercentage; }
    public void setCanaryPercentage(int canaryPercentage) { this.canaryPercentage = canaryPercentage; }
    // public boolean isActive() { return active; }
    // public void setActive(boolean active) { this.active = active; }
    public int getStatus() { return status; }
    public void setStatus(int status) { this.status = status; }
}
