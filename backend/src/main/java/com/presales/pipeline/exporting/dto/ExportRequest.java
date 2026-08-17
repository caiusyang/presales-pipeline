package com.presales.pipeline.exporting.dto;

import com.presales.pipeline.config.dto.ExportColumnRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record ExportRequest(
        @Positive Long templateId,
        String scope,
        List<@Valid ExportColumnRequest> columns,
        ExportFilters filters
) {
}
