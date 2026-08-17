package com.presales.pipeline.revenue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record RevenueEntryRequest(
        @NotNull @Positive Long projectId,
        @NotBlank String month,
        BigDecimal amount
) {
}
