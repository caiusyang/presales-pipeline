package com.presales.pipeline.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProjectProductRepository extends JpaRepository<ProjectProduct, Long> {
    @Modifying
    @Query("delete from ProjectProduct p where p.project.id = :projectId")
    void deleteAllByProjectId(@Param("projectId") Long projectId);

    List<ProjectProduct> findAllByProjectIdOrderByIdAsc(Long projectId);
}
