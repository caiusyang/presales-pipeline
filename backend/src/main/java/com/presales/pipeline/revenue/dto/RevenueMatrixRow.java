package com.presales.pipeline.revenue.dto;

import java.math.BigDecimal;
import java.util.Map;

public record RevenueMatrixRow(
        Long projectId,
        String customerName,
        String projectName,
        String industry,
        String track,
        Map<String, BigDecimal> amounts,
        BigDecimal total
) {
}
