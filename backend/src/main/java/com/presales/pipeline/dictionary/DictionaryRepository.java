package com.presales.pipeline.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DictionaryRepository extends JpaRepository<DictionaryItem, Long> {
    Optional<DictionaryItem> findByIdAndDeletedFalse(Long id);
    Optional<DictionaryItem> findFirstByTypeAndValueIgnoreCaseAndDeletedFalse(String type, String value);
    List<DictionaryItem> findAllByDeletedFalseOrderByTypeAscSortOrderAscIdAsc();
    List<DictionaryItem> findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(String type);
    boolean existsByParentIdAndDeletedFalse(Long parentId);
    boolean existsByTypeAndValueIgnoreCaseAndParentIdAndDeletedFalse(String type, String value, Long parentId);
    boolean existsByTypeAndValueIgnoreCaseAndParentIsNullAndDeletedFalse(String type, String value);
}
