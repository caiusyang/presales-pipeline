package com.presales.pipeline.importing.dto;

public record ImportRecordResult(
        int row,
        String status,
        Long projectId,
        String externalId,
        String customerName,
        String projectName,
        String reason
) {
}
