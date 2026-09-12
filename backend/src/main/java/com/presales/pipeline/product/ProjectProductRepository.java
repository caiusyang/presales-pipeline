package com.presales.pipeline.product;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectProductRepository extends JpaRepository<ProjectProduct, Long> {
    List<ProjectProduct> findAllByProjectIdOrderByIdAsc(Long projectId);
}
