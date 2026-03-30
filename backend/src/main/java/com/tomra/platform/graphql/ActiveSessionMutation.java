package com.tomra.platform.graphql;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.stereotype.Controller;

import com.tomra.platform.model.ActiveSessionEntity;
import com.tomra.platform.service.ActiveSessionService;

@Controller
public class ActiveSessionMutation {
    private final ActiveSessionService service;

    public ActiveSessionMutation(ActiveSessionService service) {
        this.service = service;
    }

    @MutationMapping
    public ActiveSessionEntity startSession(
        @Argument String projectId,
        @Argument String stableModel,
        @Argument String canaryModel,
        @Argument Integer stablePercent,
        @Argument Integer canaryPercent
    ) {
        return service.startSession(
            projectId,
            stableModel,
            canaryModel,
            stablePercent,
            canaryPercent
        );
    }

    @MutationMapping
    public boolean deactivateActiveSession(@Argument String projectId) {
        return service.deactivateActiveSession(projectId);
    }
}