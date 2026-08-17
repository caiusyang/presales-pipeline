package com.presales.pipeline.audit.dto;

import java.time.LocalDateTime;

public record ChangeLogResponse(
        Long id,
        String operator,
        String field,
        String oldValue,
        String newValue,
        String source,
        LocalDateTime createdAt
) {
}
