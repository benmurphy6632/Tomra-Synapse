package com.tomra.platform.graphql;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.stereotype.Controller;

import com.tomra.platform.dto.EngineOutput;
import com.tomra.platform.model.ClassificationResultEntity;
import com.tomra.platform.repository.ClassificationResultRepository;

@Controller
public class EngineOutputQuery {

  private final ClassificationResultRepository repository;

  public EngineOutputQuery(ClassificationResultRepository repository) {
    this.repository = repository;
  }

  @QueryMapping
  public List<EngineOutput> engineOutputs(@Argument String projectId) {
    return repository.findByProjectId(projectId)
        .stream()
        .map(this::toEngineOutput)
        .collect(Collectors.toList());
  }

  @QueryMapping
  public List<EngineOutput> engineOutputsAll() {
    return repository.findAll()
        .stream()
        .map(this::toEngineOutput)
        .collect(Collectors.toList());
  }

  private EngineOutput toEngineOutput(ClassificationResultEntity entity) {
    return new EngineOutput(
        entity.getId(),
        entity.getDeviceId(),
        entity.getImageName(),
        entity.getPredictedLabel(),
        (float) entity.getConfidence(),
        entity.getModel(),
        entity.getClassId(),
        entity.getLatency(),
        entity.getImageURL(),
        entity.getPowerUsage(),
        entity.getCO2Emissions());
  }
}