package com.presales.pipeline.importing.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record ImportRevenueRequest(
        @NotBlank String month,
        BigDecimal amount
) {
}
