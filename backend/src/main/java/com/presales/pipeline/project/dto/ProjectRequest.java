package com.presales.pipeline.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;

public record ProjectRequest(
        @Size(max = 128) String externalId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String projectName,
        @Size(max = 255) String safetySpace,
        @Size(max = 255) String solution,
        @Size(max = 255) String track,
        @Size(max = 255) String industry,
        @Size(max = 255) String subIndustry,
        @Size(max = 20000) String scenario,
        @Size(max = 20000) String keyRisks,
        @Size(max = 20000) String keyNeeds,
        @NotNull Map<String, Object> customFields
) {
}
