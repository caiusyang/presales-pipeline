package com.presales.pipeline.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChangeLogRepository extends JpaRepository<ChangeLog, Long> {
    @Query("select c.oldValue,c.newValue from ChangeLog c where c.project.id=:projectId and c.field='projectIdentity'")
    List<Object[]> identityHistory(@Param("projectId") Long projectId);
    @Modifying
    @Query("delete from ChangeLog c where c.project.id = :projectId")
    void deleteAllByProjectId(@Param("projectId") Long projectId);

    List<ChangeLog> findAllByProjectIdOrderByCreatedAtDescIdDesc(Long projectId);
}
