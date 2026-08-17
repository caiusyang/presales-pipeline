package com.presales.pipeline.dictionary.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DictionaryRequest(
        @NotBlank
        @Pattern(regexp = "^[a-z][a-z0-9_]{0,63}$", message = "只能使用小写字母、数字和下划线")
        String type,
        @NotBlank @Size(max = 255) String value,
        Long parentId,
        int sortOrder
) {
}
