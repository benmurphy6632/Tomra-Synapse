package com.tomra.platform.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.tomra.platform.model.ClassificationResultEntity;

@Repository
public interface ClassificationResultRepository extends JpaRepository<ClassificationResultEntity, Long> {
    List<ClassificationResultEntity> findByProjectId(String projectId);
}