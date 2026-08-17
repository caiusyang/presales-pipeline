package com.presales.pipeline.config;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ImportMappingRepository extends JpaRepository<ImportMapping, Long> {
    Optional<ImportMapping> findByIdAndDeletedFalse(Long id);
    List<ImportMapping> findAllByDeletedFalseOrderByNameAsc();
    boolean existsByNameIgnoreCaseAndDeletedFalse(String name);
    boolean existsByNameIgnoreCaseAndDeletedFalseAndIdNot(String name, Long id);
}
