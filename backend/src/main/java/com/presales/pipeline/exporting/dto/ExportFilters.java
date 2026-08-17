package com.presales.pipeline.exporting.dto;

import java.time.LocalDate;
import java.util.List;

public record ExportFilters(
        List<Long> projectIds,
        String industry,
        String track,
        String keyword,
        String startMonth,
        String endMonth,
        LocalDate startDate,
        LocalDate endDate
) {
}
