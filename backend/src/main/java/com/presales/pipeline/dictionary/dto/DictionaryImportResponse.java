package com.presales.pipeline.dictionary.dto;

import java.util.List;

public record DictionaryImportResponse(boolean dryRun, int added, int skipped, int failed, List<Detail> details) {
    public record Detail(Integer sourceRow, String value, String status, String reason, Long id) { }
}
