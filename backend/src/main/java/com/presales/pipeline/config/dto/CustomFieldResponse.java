package com.presales.pipeline.config.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CustomFieldResponse(
        Long id,
        String fieldKey,
        String label,
        String fieldType,
        boolean required,
        List<String> options,
        int sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
