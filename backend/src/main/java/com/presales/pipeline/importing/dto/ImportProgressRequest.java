package com.presales.pipeline.importing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ImportProgressRequest(
        @NotNull LocalDate logDate,
        @NotBlank @Size(max = 10000) String content
) {
}
