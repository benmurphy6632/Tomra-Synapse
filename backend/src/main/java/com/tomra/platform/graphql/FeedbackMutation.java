package com.tomra.platform.graphql;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.stereotype.Controller;

import com.tomra.platform.service.FeedbackService;

@Controller
public class FeedbackMutation {

    private final FeedbackService service;

    public FeedbackMutation(FeedbackService service) {
        this.service = service;
    }

    @MutationMapping
    public Boolean voteFeedback(
        @Argument String projectId,
        @Argument Long resultId,
        @Argument String model,
        @Argument String imageName,
        @Argument String deviceId,
        @Argument String imageURL,
        @Argument String vote
    ) {
        service.saveVote(
            projectId,
            resultId,
            model,
            imageName,
            deviceId,
            imageURL,
            vote
        );
        return true;
    }

    @MutationMapping
    public Boolean removeVote(
        @Argument String projectId,
        @Argument Long resultId
    ) {
        service.removeVote(projectId, resultId);
        return true;
    }
}