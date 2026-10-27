package com.presales.pipeline.progress;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProgressLogRepository extends JpaRepository<ProgressLog, Long> {
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
