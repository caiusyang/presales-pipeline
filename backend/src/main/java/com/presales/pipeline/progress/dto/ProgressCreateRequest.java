package com.presales.pipeline.progress.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ProgressCreateRequest(
        @NotNull @Positive Long projectId,
        @NotNull LocalDate logDate,
        @NotBlank @Size(max = 10000) String content
) {
}
