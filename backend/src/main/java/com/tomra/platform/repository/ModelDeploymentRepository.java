
package com.tomra.platform.repository;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.tomra.platform.model.ModelDeploymentEntity;
/**
 * ModelDeploymentRepository
 *
 * This is a Spring Data JPA repository for ModelDeploymentEntity.
 * It follows the exact same pattern as ClassificationResultRepository.
 *
 * By extending JpaRepository, we get standard database operations for free
 * (save, findById, findAll, delete etc.) without writing any SQL.
 *
 * We add one custom query method — findByActive — which Spring Data
 * automatically implements based on the method name. It translates to:
 * SELECT * FROM model_deployment_entity WHERE active = ?
 *
 * This is used in two places:
 * 1. In ResultReceiverGrpcServer.subscribeToDeployments — to replay the
 *    current active deployment to an edge device that just connected
 * 2. In the deployment trigger logic — to deactivate the previous
 *    deployment before saving the new one
 */
@Repository
public interface ModelDeploymentRepository extends JpaRepository<ModelDeploymentEntity, Long> {

    /**
     * Finds the currently active deployment.
     * Returns Optional.empty() if no deployment has been triggered yet.
     * Should only ever return one result since only one deployment
     * is active at a time.
     */
    // Optional<ModelDeploymentEntity> findByActive(boolean active);
    List<ModelDeploymentEntity> findByStatusIn(List<Integer> statuses);
}