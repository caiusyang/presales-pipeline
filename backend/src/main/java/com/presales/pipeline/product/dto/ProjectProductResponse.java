package com.presales.pipeline.product.dto;

import java.time.LocalDateTime;

public record ProjectProductResponse(
        Long id,
        Long projectId,
        String productCode,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
