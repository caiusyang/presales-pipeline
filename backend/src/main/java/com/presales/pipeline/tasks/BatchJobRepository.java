package com.presales.pipeline.tasks;

import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface BatchJobRepository extends JpaRepository<BatchJob,String> {
    Optional<BatchJob> findByRequestKey(String key);
    List<BatchJob> findTop30ByOrderByCreatedAtDesc();
    List<BatchJob> findByStatusIn(List<String> statuses);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select j from BatchJob j where j.id=:id")
    Optional<BatchJob> lock(String id);
}
