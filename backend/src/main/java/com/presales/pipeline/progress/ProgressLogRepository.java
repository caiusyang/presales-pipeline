package com.presales.pipeline.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProgressLogRepository extends JpaRepository<ProgressLog, Long> {
    @Query("select l.id from ProgressLog l where l.project.id=:projectId")
    List<Long> allIdsForProject(@Param("projectId") Long projectId);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ProgressLog l where l.id=:id") Optional<ProgressLog> findByIdForUpdate(@Param("id") Long id);
    @Query(value="select l from ProgressLog l join fetch l.project p where l.deleted=false and p.deleted=false and (:projectId is null or p.id=:projectId) order by l.id",countQuery="select count(l) from ProgressLog l where l.deleted=false and l.project.deleted=false and (:projectId is null or l.project.id=:projectId)")
    org.springframework.data.domain.Page<ProgressLog> repairPage(@Param("projectId") Long projectId,org.springframework.data.domain.Pageable page);
    @Query("select l from ProgressLog l join fetch l.project p where l.deleted=false and p.deleted=false and p.id in :ids order by l.logDate desc,l.id desc")
    List<ProgressLog> findActiveByProjectIds(@Param("ids") List<Long> ids);
    @Modifying
    @Query("delete from ProgressLog p where p.project.id = :projectId")
    void deleteAllByProjectId(@Param("projectId") Long projectId);

    Optional<ProgressLog> findByIdAndDeletedFalse(Long id);
    List<ProgressLog> findAllByProjectIdAndDeletedFalseOrderByLogDateDescIdDesc(Long projectId);
    List<ProgressLog> findAllByDeletedFalseOrderByLogDateDescIdDesc();
    boolean existsByProjectIdAndLogDateAndContentAndDeletedFalse(Long projectId, LocalDate logDate, String content);

    @Query("""
            select log from ProgressLog log
            join fetch log.project project
            where log.deleted = false and project.deleted = false
            order by log.logDate desc, log.id desc
            """)
    List<ProgressLog> findAllActiveWithProject();
}
