package com.presales.pipeline.importing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ImportFieldDefinition(
        @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]{0,63}$") String fieldKey,
        @NotBlank @Size(max = 255) String label,
        @NotBlank @Pattern(regexp = "text|number|date") String fieldType
) {}
