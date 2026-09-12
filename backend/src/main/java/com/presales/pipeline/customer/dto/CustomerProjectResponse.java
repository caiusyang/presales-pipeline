package com.presales.pipeline.customer.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record CustomerProjectResponse(
        Long id,
        String externalId,
        String projectName,
        String projectStatus,
        String industry,
        String track,
        String solution,
        String subSolution,
        List<String> purchasedProducts,
        BigDecimal revenueTotal,
        LocalDateTime updatedAt
) {
}
