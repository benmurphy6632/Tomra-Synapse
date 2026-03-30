package com.tomra.platform.graphql;

import java.util.List;

import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import com.tomra.platform.dto.AvailableModel;
import com.tomra.platform.service.AvailableModelStore;

@Controller
public class AvailableModelQuery {

    private final AvailableModelStore availableModelStore;

    public AvailableModelQuery(AvailableModelStore availableModelStore) {
        this.availableModelStore = availableModelStore;
    }

    @QueryMapping
    public List<AvailableModel> availableModels() {
        return availableModelStore.getModels();
    }
}