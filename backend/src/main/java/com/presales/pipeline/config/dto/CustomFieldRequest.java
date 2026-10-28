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
        int sortOrder,
        @Pattern(regexp = "^[a-z][a-z0-9_]{0,63}$", message = "字典标识格式不正确") String dictionaryType,
        @Size(max=2) List<String> applicableTracks
) {
    public CustomFieldRequest(String fieldKey,String label,String fieldType,boolean required,List<String> options,int sortOrder,String dictionaryType){this(fieldKey,label,fieldType,required,options,sortOrder,dictionaryType,List.of());}
    public CustomFieldRequest(String fieldKey, String label, String fieldType, boolean required, List<String> options, int sortOrder) {
        this(fieldKey, label, fieldType, required, options, sortOrder, null,List.of());
    }
}
