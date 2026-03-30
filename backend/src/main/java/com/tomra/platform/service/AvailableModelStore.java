package com.tomra.platform.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.tomra.platform.dto.AvailableModel;

@Service
public class AvailableModelStore {

    private final List<AvailableModel> models = new ArrayList<>();

    public synchronized void setModels(List<AvailableModel> newModels) {
        models.clear();
        models.addAll(newModels);
    }

    public synchronized List<AvailableModel> getModels() {
        return List.copyOf(models);
    }
}