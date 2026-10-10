package com.presales.pipeline.importing.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record ImportRecordRequest(
        @NotNull Map<String, Object> fields,
        @NotNull @Size(max = 240) List<ImportRevenueRequest> revenues,
        @NotNull @Size(max = 1000) List<ImportProgressRequest> progress,
        @jakarta.validation.constraints.Positive Integer sourceRow
) {
}
