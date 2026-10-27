package com.presales.pipeline.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DictionaryCategoryRepository extends JpaRepository<DictionaryCategory, Long> {
    Optional<DictionaryCategory> findByTypeAndDeletedFalse(String type);
    Optional<DictionaryCategory> findByType(String type);
    Optional<DictionaryCategory> findByIdAndDeletedFalse(Long id);
    List<DictionaryCategory> findAllByDeletedFalseOrderBySortOrderAscIdAsc();
}
