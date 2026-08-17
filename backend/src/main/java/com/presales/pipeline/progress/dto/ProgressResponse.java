package com.presales.pipeline.progress.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record ProgressResponse(
        Long id,
        Long projectId,
        LocalDate logDate,
        String content,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
