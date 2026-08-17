package com.presales.pipeline.revenue.dto;

public record RevenueBatchResponse(
        int created,
        int updated,
        int cleared,
        int unchanged
) {
}
