package com.tomra.platform.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

/**
 * ActiveSessionEntity
 *
 * JPA entity that stores the currently created classification session
 * coming from the frontend Start Session action.
 *
 * Each session links a project to its selected stable/canary models and
 * traffic split at the time the session is started.
 */
@Entity
public class ActiveSessionEntity {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_INACTIVE = "INACTIVE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sessionId;

    private String projectId;

    private String stableModel;

    private String canaryModel;

    private int stablePercent;

    private int canaryPercent;

    private String status;

    /**
     * Timestamp when the session was created.
     * Used for ordering (oldest → newest).
     */
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getStableModel() {
        return stableModel;
    }

    public void setStableModel(String stableModel) {
        this.stableModel = stableModel;
    }

    public String getCanaryModel() {
        return canaryModel;
    }

    public void setCanaryModel(String canaryModel) {
        this.canaryModel = canaryModel;
    }

    public int getStablePercent() {
        return stablePercent;
    }

    public void setStablePercent(int stablePercent) {
        this.stablePercent = stablePercent;
    }

    public int getCanaryPercent() {
        return canaryPercent;
    }

    public void setCanaryPercent(int canaryPercent) {
        this.canaryPercent = canaryPercent;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isActive() {
        return STATUS_ACTIVE.equalsIgnoreCase(status);
    }

    public void markActive() {
        this.status = STATUS_ACTIVE;
    }

    public void markInactive() {
        this.status = STATUS_INACTIVE;
    }
}