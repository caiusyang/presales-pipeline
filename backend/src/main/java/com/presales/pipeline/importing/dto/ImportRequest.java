package com.presales.pipeline.importing.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ImportRequest(
        @Positive Long mappingId,
        boolean dryRun,
        @NotEmpty @Size(max = 5000) List<@Valid ImportRecordRequest> records
) {
}
