package com.presales.pipeline.backup.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record BackupResponse(
        int formatVersion,
        LocalDateTime exportedAt,
        String timezone,
        String amountUnit,
        Map<String, List<Map<String, Object>>> tables
) {
}
