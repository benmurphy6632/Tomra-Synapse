package com.tomra.platform.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.tomra.platform.model.ClassificationResultEntity;

@DataJpaTest
class ClassificationResultRepositoryTest {

  @Autowired
  private ClassificationResultRepository repository;

  @Test
  void save_persistsEntity_andCanBeFoundById() {
    ClassificationResultEntity entity = new ClassificationResultEntity();
    entity.setDeviceId("dev-1");
    entity.setImageName("test.png");
    entity.setPredictedLabel("orange");
    entity.setConfidence(0.95);
    entity.setModel("model-v1");
    entity.setClassId(950);
    entity.setLatency(0.12);
    entity.setImageURL("http://example.com/img.png");

    ClassificationResultEntity saved = repository.save(entity);

    assertNotNull(saved.getId());
    Optional<ClassificationResultEntity> found = repository.findById(saved.getId());
    assertTrue(found.isPresent());
    assertEquals("dev-1", found.get().getDeviceId());
    assertEquals("test.png", found.get().getImageName());
    assertEquals("orange", found.get().getPredictedLabel());
    assertEquals(0.95, found.get().getConfidence());
    assertEquals("model-v1", found.get().getModel());
    assertEquals(950, found.get().getClassId());
    assertEquals(0.12, found.get().getLatency());
    assertEquals("http://example.com/img.png", found.get().getImageURL());
  }

  @Test
  void findAll_returnsAllSavedEntities() {
    ClassificationResultEntity e1 = new ClassificationResultEntity();
    e1.setDeviceId("dev-1");
    e1.setImageName("a.png");
    e1.setPredictedLabel("cat");
    e1.setConfidence(0.8);
    e1.setModel("m1");
    e1.setClassId(281);
    e1.setLatency(0.1);
    e1.setImageURL(null);

    ClassificationResultEntity e2 = new ClassificationResultEntity();
    e2.setDeviceId("dev-2");
    e2.setImageName("b.png");
    e2.setPredictedLabel("dog");
    e2.setConfidence(0.9);
    e2.setModel("m1");
    e2.setClassId(207);
    e2.setLatency(0.15);
    e2.setImageURL("http://example.com/b.png");

    repository.save(e1);
    repository.save(e2);

    List<ClassificationResultEntity> all = repository.findAll();
    assertEquals(2, all.size());
  }

  @Test
  void count_returnsNumberOfSavedEntities() {
    assertEquals(0, repository.count());

    repository.save(newEntity("dev-1", "a.png"));
    assertEquals(1, repository.count());

    repository.save(newEntity("dev-2", "b.png"));
    assertEquals(2, repository.count());
  }

  @Test
  void deleteById_removesEntity() {
    ClassificationResultEntity entity = repository.save(newEntity("dev-1", "x.png"));
    Long id = entity.getId();
    assertEquals(1, repository.count());

    repository.deleteById(id);
    assertEquals(0, repository.count());
    assertTrue(repository.findById(id).isEmpty());
  }

  @Test
  void saveAndFlush_persistsImmediately() {
    ClassificationResultEntity entity = newEntity("dev-1", "flush.png");
    ClassificationResultEntity saved = repository.saveAndFlush(entity);
    assertNotNull(saved.getId());
    assertTrue(repository.findById(saved.getId()).isPresent());
  }

  private static ClassificationResultEntity newEntity(String deviceId, String imageName) {
    ClassificationResultEntity e = new ClassificationResultEntity();
    e.setDeviceId(deviceId);
    e.setImageName(imageName);
    e.setPredictedLabel("label");
    e.setConfidence(0.5);
    e.setModel("model");
    e.setClassId(0);
    e.setLatency(0.0);
    e.setImageURL(null);
    return e;
  }
}
