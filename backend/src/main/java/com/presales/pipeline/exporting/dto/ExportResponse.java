package com.presales.pipeline.exporting.dto;

import com.presales.pipeline.config.dto.ExportColumnRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record ExportResponse(
        String scope,
        List<ExportColumnRequest> columns,
        List<Map<String, Object>> rows,
        int totalRows,
        LocalDateTime generatedAt
) {
}
