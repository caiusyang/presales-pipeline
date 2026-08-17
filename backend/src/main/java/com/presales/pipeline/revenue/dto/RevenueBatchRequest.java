package com.presales.pipeline.revenue.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RevenueBatchRequest(
        @NotEmpty @Size(max = 5000) List<@Valid RevenueEntryRequest> entries
) {
}
