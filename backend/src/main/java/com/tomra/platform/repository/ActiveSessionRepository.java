package com.tomra.platform.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.tomra.platform.model.ActiveSessionEntity;

public interface ActiveSessionRepository extends JpaRepository<ActiveSessionEntity, Long> {

    Optional<ActiveSessionEntity> findFirstByStatus(String status);

    List<ActiveSessionEntity> findByStatus(String status);

    List<ActiveSessionEntity> findByStatusOrderByCreatedAtAsc(String status);

    Optional<ActiveSessionEntity> findFirstByProjectIdAndStatus(String projectId, String status);
}