package com.presales.pipeline.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChangeLogRepository extends JpaRepository<ChangeLog, Long> {
    List<ChangeLog> findAllByProjectIdOrderByCreatedAtDescIdDesc(Long projectId);
}
