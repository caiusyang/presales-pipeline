package com.presales.pipeline.project.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.Map;
import java.util.List;

public record ProjectRequest(
        @Size(max = 128) String externalId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String projectName,
        @Size(max = 32) String projectStatus,
        @DecimalMin(value = "0", message = "客户安全预算不能为负数")
        @Digits(integer = 16, fraction = 2, message = "客户安全预算最多 16 位整数、2 位小数")
        BigDecimal securityBudget,
        @Size(max = 255) String solution,
        @Size(max = 255) String subSolution,
        List<@Size(max = 255) String> purchasedProducts,
        @Size(max = 255) String track,
        @Size(max = 255) String industry,
        @Size(max = 255) String subIndustry,
        @Size(max = 20000) String scenario,
        @Size(max = 20000) String keyRisks,
        @Size(max = 20000) String keyNeeds,
        @NotNull Map<String, Object> customFields
) {
}
