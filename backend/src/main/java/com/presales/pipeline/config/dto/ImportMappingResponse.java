package com.presales.pipeline.config.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record ImportMappingResponse(
        Long id,
        String name,
        Map<String, Object> columnMap,
        List<Map<String, Object>> valueRules,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
