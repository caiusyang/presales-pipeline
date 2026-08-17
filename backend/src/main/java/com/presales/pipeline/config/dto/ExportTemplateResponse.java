package com.presales.pipeline.config.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ExportTemplateResponse(
        Long id,
        String name,
        String scope,
        List<ExportColumnRequest> columns,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
