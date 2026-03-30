package com.tomra.platform.graphql;

import org.springframework.graphql.data.method.annotation.QueryMapping;

import java.util.List;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.stereotype.Controller;

import com.tomra.platform.dto.FeedbackStatsProjection;
import com.tomra.platform.model.FeedbackEntity;
import com.tomra.platform.service.FeedbackService;

@Controller
public class FeedbackQuery {
    private final FeedbackService service;

    public FeedbackQuery(FeedbackService service) {
        this.service = service;
    }

    @QueryMapping
    public FeedbackStatsProjection feedbackStats(@Argument String projectId) {
        return service.getStats(projectId);
    }

    @QueryMapping
    public List<FeedbackEntity> feedbackVotes(@Argument String projectId) {
        return service.getFeedbackVotes(projectId);
    }
}