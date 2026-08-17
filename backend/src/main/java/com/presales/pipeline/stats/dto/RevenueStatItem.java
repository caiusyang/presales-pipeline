package com.presales.pipeline.stats.dto;

import java.math.BigDecimal;

public record RevenueStatItem(String key, String label, BigDecimal amount) {
}
