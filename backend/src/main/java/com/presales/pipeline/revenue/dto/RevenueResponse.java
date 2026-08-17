package com.presales.pipeline.revenue.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record RevenueResponse(
        Long id,
        Long projectId,
        String month,
        BigDecimal amount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
