package com.presales.pipeline.tasks;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface BatchJobItemRepository extends JpaRepository<BatchJobItem,Long> {
    List<BatchJobItem> findByJobIdOrderByItemIndex(String jobId);
    List<BatchJobItem> findByJobIdAndStatusOrderByItemIndex(String jobId,String status,Pageable page);
    long countByJobId(String id);
    org.springframework.data.domain.Page<BatchJobItem> findByJobIdOrderByItemIndex(String jobId,Pageable page);
    @Query("select i.status,sum(i.weight) from BatchJobItem i where i.jobId=:id group by i.status") List<Object[]> counts(String id);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select i from BatchJobItem i where i.id=:id")
    Optional<BatchJobItem> lock(Long id);
}
