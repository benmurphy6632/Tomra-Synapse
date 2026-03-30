package com.tomra.platform.graphql;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tomra.platform.dto.EngineOutput;
import com.tomra.platform.model.ClassificationResultEntity;
import com.tomra.platform.repository.ClassificationResultRepository;

class EngineOutputQueryTest {

  private ClassificationResultRepository repository;
  private EngineOutputQuery engineOutputQuery;

  @BeforeEach
  void setUp() {
    repository = mock(ClassificationResultRepository.class);
    engineOutputQuery = new EngineOutputQuery(repository);
  }

  @Test
  void engineOutputs_returnsEmptyList_whenRepositoryEmpty() {
    when(repository.findByProjectId("project-1")).thenReturn(List.of());

    List<EngineOutput> result = engineOutputQuery.engineOutputs("project-1");

    assertNotNull(result);
    assertEquals(0, result.size());
  }

  @Test
  void engineOutputs_mapsEntityToEngineOutput_matchingSchema() {
    ClassificationResultEntity entity = new ClassificationResultEntity();
    entity.setProjectId("project-1");
    entity.setDeviceId("test-device");
    entity.setImageName("sample.png");
    entity.setPredictedLabel("orange");
    entity.setConfidence(0.95);
    entity.setModel("python-classifier-v1");
    entity.setClassId(950);
    entity.setLatency(0.12);
    entity.setImageURL("");

    when(repository.findByProjectId("project-1")).thenReturn(List.of(entity));

    List<EngineOutput> result = engineOutputQuery.engineOutputs("project-1");

    assertNotNull(result);
    assertEquals(1, result.size());

    EngineOutput output = result.get(0);
    assertEquals("test-device", output.getDeviceId());
    assertEquals("sample.png", output.getImageName());
    assertEquals("orange", output.getPredictedLabel());
    assertEquals(0.95f, output.getConfidence());
    assertEquals("python-classifier-v1", output.getModel());
    assertEquals(950, output.getClassId());
    assertEquals(0.12, output.getLatency());
    assertNotNull(output.getImageURL());
  }

  @Test
  void engineOutputs_returnsMultipleOutputs_whenRepositoryHasMultiple() {
    ClassificationResultEntity e1 = new ClassificationResultEntity();
    e1.setProjectId("project-1");
    e1.setDeviceId("dev-1");
    e1.setImageName("a.png");
    e1.setPredictedLabel("cat");
    e1.setConfidence(0.8);
    e1.setModel("model-v1");
    e1.setClassId(281);
    e1.setLatency(0.1);
    e1.setImageURL("");

    ClassificationResultEntity e2 = new ClassificationResultEntity();
    e2.setProjectId("project-1");
    e2.setDeviceId("dev-2");
    e2.setImageName("b.png");
    e2.setPredictedLabel("dog");
    e2.setConfidence(0.9);
    e2.setModel("model-v1");
    e2.setClassId(207);
    e2.setLatency(0.15);
    e2.setImageURL("https://example.com/image2.png");

    when(repository.findByProjectId("project-1")).thenReturn(List.of(e1, e2));

    List<EngineOutput> result = engineOutputQuery.engineOutputs("project-1");

    assertNotNull(result);
    assertEquals(2, result.size());
    assertEquals("cat", result.get(0).getPredictedLabel());
    assertEquals("dog", result.get(1).getPredictedLabel());
  }

  @Test
  void engineOutputsAll_returnsAllOutputs_whenRepositoryHasMultiple() {
    ClassificationResultEntity e1 = new ClassificationResultEntity();
    e1.setProjectId("project-1");
    e1.setDeviceId("dev-1");
    e1.setImageName("a.png");
    e1.setPredictedLabel("cat");
    e1.setConfidence(0.8);
    e1.setModel("model-v1");
    e1.setClassId(281);
    e1.setLatency(0.1);
    e1.setImageURL("");

    ClassificationResultEntity e2 = new ClassificationResultEntity();
    e2.setProjectId("project-2");
    e2.setDeviceId("dev-2");
    e2.setImageName("b.png");
    e2.setPredictedLabel("dog");
    e2.setConfidence(0.9);
    e2.setModel("model-v2");
    e2.setClassId(207);
    e2.setLatency(0.15);
    e2.setImageURL("https://example.com/image2.png");

    when(repository.findAll()).thenReturn(List.of(e1, e2));

    List<EngineOutput> result = engineOutputQuery.engineOutputsAll();

    assertNotNull(result);
    assertEquals(2, result.size());
    assertEquals("cat", result.get(0).getPredictedLabel());
    assertEquals("dog", result.get(1).getPredictedLabel());
  }
}