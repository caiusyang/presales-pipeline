package com.presales.pipeline.importing.dto;

import java.util.List;

public record ImportResponse(
        boolean dryRun,
        Long mappingId,
        int added,
        int overwritten,
        int skipped,
        List<ImportRecordResult> details
) {
}
