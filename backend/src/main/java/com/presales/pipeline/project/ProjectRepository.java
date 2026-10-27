package com.presales.pipeline.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long>, JpaSpecificationExecutor<Project> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :id")
    Optional<Project> findByIdForUpdate(@Param("id") Long id);

    Optional<Project> findByIdAndDeletedFalse(Long id);
    Optional<Project> findByExternalId(String externalId);
    Optional<Project> findFirstByExternalIdAndDeletedFalse(String externalId);
    Optional<Project> findFirstByCustomerNameIgnoreCaseAndProjectNameIgnoreCaseAndDeletedFalse(
            String customerName, String projectName);
    boolean existsByExternalIdAndIdNot(String externalId, Long id);
    boolean existsByCustomerNameIgnoreCaseAndProjectNameIgnoreCaseAndDeletedFalseAndIdNot(
            String customerName, String projectName, Long id);
    List<Project> findAllByDeletedFalseOrderByIdAsc();
}
