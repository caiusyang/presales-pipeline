package com.presales.pipeline.revenue.dto;

import java.util.List;

public record RevenueMatrixResponse(
        List<String> months,
        List<RevenueMatrixRow> rows
) {
}
