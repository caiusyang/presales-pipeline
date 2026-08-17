package com.presales.pipeline.dictionary.dto;

import java.time.LocalDateTime;
import java.util.List;

public record DictionaryNodeResponse(
        Long id,
        String type,
        String value,
        Long parentId,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<DictionaryNodeResponse> children
) {
}
