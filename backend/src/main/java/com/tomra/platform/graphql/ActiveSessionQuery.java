package com.tomra.platform.graphql;

import java.util.List;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import com.tomra.platform.model.ActiveSessionEntity;
import com.tomra.platform.service.ActiveSessionService;

@Controller
public class ActiveSessionQuery {
    private final ActiveSessionService service;

    public ActiveSessionQuery(ActiveSessionService service) {
        this.service = service;
    }

    @QueryMapping
    public ActiveSessionEntity activeSession(@Argument String projectId) {
        return service.getActiveSessionForProject(projectId);
    }

    @QueryMapping
    public List<ActiveSessionEntity> activeSessions() {
        return service.getAllActiveSessions();
    }
}