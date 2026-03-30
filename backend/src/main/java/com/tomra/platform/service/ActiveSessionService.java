package com.tomra.platform.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.tomra.platform.model.ActiveSessionEntity;
import com.tomra.platform.repository.ActiveSessionRepository;

@Service
public class ActiveSessionService {

    private final ActiveSessionRepository activeSessionRepository;

    public ActiveSessionService(ActiveSessionRepository activeSessionRepository) {
        this.activeSessionRepository = activeSessionRepository;
    }

    public ActiveSessionEntity startSession(
        String projectId,
        String stableModel,
        String canaryModel,
        int stablePercent,
        int canaryPercent
    ) {
        String normalizedStableModel = normalizeModelName(stableModel);
        String normalizedCanaryModel = normalizeModelName(canaryModel);

        boolean hasStableModel = normalizedStableModel != null;
        boolean hasCanaryModel = normalizedCanaryModel != null;

        if (!hasStableModel && !hasCanaryModel) {
            throw new IllegalArgumentException("At least one model must be selected.");
        }

        int finalStablePercent;
        int finalCanaryPercent;

        if (hasStableModel && hasCanaryModel) {
            finalCanaryPercent = clamp(canaryPercent, 0, 100);
            finalStablePercent = clamp(stablePercent, 0, 100);

            int total = finalStablePercent + finalCanaryPercent;

            if (total == 0) {
                finalStablePercent = 50;
                finalCanaryPercent = 50;
            } else if (total != 100) {
                finalStablePercent = (int) Math.round((finalStablePercent * 100.0) / total);
                finalCanaryPercent = 100 - finalStablePercent;
            }
        } else if (hasStableModel) {
            finalStablePercent = 100;
            finalCanaryPercent = 0;
        } else {
            finalStablePercent = 0;
            finalCanaryPercent = 100;
        }

        ActiveSessionEntity existingProjectSession = activeSessionRepository
            .findFirstByProjectIdAndStatus(projectId, ActiveSessionEntity.STATUS_ACTIVE)
            .orElse(null);

        if (existingProjectSession != null) {
            existingProjectSession.markInactive();
            activeSessionRepository.save(existingProjectSession);
        }

        String sessionId = "sess-" + UUID.randomUUID();

        ActiveSessionEntity session = new ActiveSessionEntity();
        session.setSessionId(sessionId);
        session.setProjectId(projectId);
        session.setStableModel(normalizedStableModel);
        session.setCanaryModel(normalizedCanaryModel);
        session.setStablePercent(finalStablePercent);
        session.setCanaryPercent(finalCanaryPercent);
        session.setCreatedAt(Instant.now());
        session.markActive();

        return activeSessionRepository.save(session);
    }

    public ActiveSessionEntity getActiveSession() {
        return activeSessionRepository
            .findFirstByStatus(ActiveSessionEntity.STATUS_ACTIVE)
            .orElse(null);
    }

    public List<ActiveSessionEntity> getAllActiveSessions() {
        return activeSessionRepository.findByStatus(ActiveSessionEntity.STATUS_ACTIVE);
    }

    public ActiveSessionEntity getActiveSessionForProject(String projectId) {
        return activeSessionRepository
            .findFirstByProjectIdAndStatus(projectId, ActiveSessionEntity.STATUS_ACTIVE)
            .orElse(null);
    }

    public boolean deactivateActiveSession(String projectId) {
        ActiveSessionEntity activeSession = activeSessionRepository
            .findFirstByProjectIdAndStatus(projectId, ActiveSessionEntity.STATUS_ACTIVE)
            .orElse(null);

        if (activeSession == null) {
            return false;
        }

        activeSession.markInactive();
        activeSessionRepository.save(activeSession);
        return true;
    }

    private String normalizeModelName(String modelName) {
        if (modelName == null) {
            return null;
        }

        String trimmed = modelName.trim();
        if (trimmed.isEmpty() || "None".equalsIgnoreCase(trimmed)) {
            return null;
        }

        return trimmed;
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}