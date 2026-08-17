package com.presales.pipeline.config.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CustomFieldRequest(
        @NotBlank
        @Pattern(regexp = "^[a-z][a-z0-9_]{0,63}$", message = "只能使用小写字母、数字和下划线，且必须以字母开头")
        String fieldKey,
        @NotBlank @Size(max = 255) String label,
        @NotBlank String fieldType,
        boolean required,
        @NotNull List<@NotBlank String> options,
        int sortOrder
) {
}
