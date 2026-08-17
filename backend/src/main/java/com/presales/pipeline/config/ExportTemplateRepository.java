package com.presales.pipeline.config;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExportTemplateRepository extends JpaRepository<ExportTemplate, Long> {
    Optional<ExportTemplate> findByIdAndDeletedFalse(Long id);
    List<ExportTemplate> findAllByDeletedFalseOrderByScopeAscNameAsc();
    boolean existsByNameIgnoreCaseAndScopeAndDeletedFalse(String name, String scope);
    boolean existsByNameIgnoreCaseAndScopeAndDeletedFalseAndIdNot(String name, String scope, Long id);
}
