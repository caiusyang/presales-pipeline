package com.presales.pipeline.importing.dto;

public record ImportRecordResult(
        int row,
        String status,
        Long projectId,
        String externalId,
        String customerName,
        String projectName,
        String reason,
        Integer sourceRow,
        java.util.List<ImportIssue> issues,
        java.util.Map<String, Object> effectiveFields
) {
}
