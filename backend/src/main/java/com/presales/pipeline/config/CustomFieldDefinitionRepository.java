package com.presales.pipeline.config;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomFieldDefinitionRepository extends JpaRepository<CustomFieldDefinition, Long> {
    Optional<CustomFieldDefinition> findByIdAndDeletedFalse(Long id);
    Optional<CustomFieldDefinition> findByFieldKeyAndDeletedFalse(String fieldKey);
    List<CustomFieldDefinition> findAllByDeletedFalseOrderBySortOrderAscIdAsc();
    boolean existsByFieldKey(String fieldKey);
}
