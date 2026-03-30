package com.tomra.platform.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.tomra.platform.dto.FeedbackStatsProjection;
import com.tomra.platform.model.FeedbackEntity;
import com.tomra.platform.repository.FeedbackRepository;

import jakarta.transaction.Transactional;

@Service
public class FeedbackService {

    private final FeedbackRepository repo;

    public FeedbackService(FeedbackRepository repo) {
        this.repo = repo;
    }

    public FeedbackStatsProjection getStats(String projectId) {
        return repo.getStats(projectId);
    }

    public List<FeedbackEntity> getFeedbackVotes(String projectId) {
        return repo.findByProjectId(projectId);
    }

    public void saveVote(
        String projectId,
        Long resultId,
        String model,
        String imageName,
        String deviceId,
        String imageURL,
        String vote
    ) {
        FeedbackEntity entity = repo
            .findByProjectIdAndResultId(projectId, resultId)
            .orElse(new FeedbackEntity());

        entity.setProjectId(projectId);
        entity.setResultId(resultId);
        entity.setModel(model);
        entity.setImageName(imageName);
        entity.setDeviceId(deviceId);
        entity.setImageURL(imageURL);
        entity.setVote(vote);

        repo.save(entity);
    }

    @Transactional
    public void removeVote(
        String projectId,
        Long resultId
    ) {
        repo.deleteByProjectIdAndResultId(projectId, resultId);
    }
}