package com.presales.pipeline.dictionary.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record DictionaryImportRequest(
        @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]{0,63}$", message = "字典标识格式不正确") String type,
        Long parentId,
        boolean dryRun,
        @NotNull @Size(min = 1, max = 5000, message = "每次需导入1至5000行") List<Row> records
) {
    public record Row(Integer sourceRow, String value) { }
}
