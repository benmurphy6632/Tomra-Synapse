package com.tomra.platform.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

import com.tomra.platform.dto.FeedbackStatsProjection;
import com.tomra.platform.model.FeedbackEntity;

import jakarta.transaction.Transactional;

import java.util.Optional;
import java.util.List;

public interface FeedbackRepository extends JpaRepository<FeedbackEntity, Long> {
    @Query(value = """
        SELECT 
            COALESCE(SUM(CASE WHEN vote='UP' THEN 1 ELSE 0 END),0) AS up,
            COALESCE(SUM(CASE WHEN vote='DOWN' THEN 1 ELSE 0 END),0) AS down,
            COALESCE(SUM(CASE WHEN vote='UNSURE' THEN 1 ELSE 0 END),0) AS unsure
        FROM feedback_votes
        WHERE project_id = :projectId
        """, nativeQuery = true)
    FeedbackStatsProjection getStats(@Param("projectId") String projectId);

    List<FeedbackEntity> findByProjectId(String projectId);

    Optional<FeedbackEntity> findByProjectIdAndResultId(
        String projectId,
        Long resultId
    );

    @Transactional
    void deleteByProjectIdAndResultId(
        String projectId,
        Long resultId
    );
}