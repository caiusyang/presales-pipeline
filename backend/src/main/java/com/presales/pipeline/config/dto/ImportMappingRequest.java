package com.presales.pipeline.config.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record ImportMappingRequest(
        @NotBlank @Size(max = 255) String name,
        @NotNull Map<String, Object> columnMap,
        @NotNull List<Map<String, Object>> valueRules,
        String applicableTrack
) {
    public ImportMappingRequest(String name,Map<String,Object> columnMap,List<Map<String,Object>> valueRules){this(name,columnMap,valueRules,null);}
}
