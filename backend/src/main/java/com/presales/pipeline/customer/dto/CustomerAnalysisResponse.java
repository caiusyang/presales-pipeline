package com.presales.pipeline.customer.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record CustomerAnalysisResponse(
        String customerName,
        int projectCount,
        int wonProjectCount,
        Map<String, Integer> statusCounts,
        List<String> purchasedProducts,
        BigDecimal revenueTotal,
        LocalDateTime updatedAt,
        List<CustomerProjectResponse> projects
) {
}
