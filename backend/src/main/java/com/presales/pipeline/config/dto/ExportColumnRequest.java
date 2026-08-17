package com.presales.pipeline.config.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExportColumnRequest(
        @NotBlank @Size(max = 128) String key,
        @NotBlank @Size(max = 255) String title
) {
}
