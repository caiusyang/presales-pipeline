package com.presales.pipeline.stats.dto;

import java.math.BigDecimal;
import java.util.List;

public record RevenueStatsResponse(
        String dimension,
        Integer year,
        BigDecimal total,
        List<RevenueStatItem> items
) {
}
