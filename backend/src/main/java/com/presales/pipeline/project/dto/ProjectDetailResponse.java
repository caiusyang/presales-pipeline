package com.presales.pipeline.project.dto;

import com.presales.pipeline.audit.dto.ChangeLogResponse;
import com.presales.pipeline.progress.dto.ProgressResponse;
import com.presales.pipeline.revenue.dto.RevenueResponse;

import java.util.List;

public record ProjectDetailResponse(
        ProjectResponse project,
        List<ProgressResponse> progress,
        List<RevenueResponse> revenues,
        List<ChangeLogResponse> changeLogs
) {
}
