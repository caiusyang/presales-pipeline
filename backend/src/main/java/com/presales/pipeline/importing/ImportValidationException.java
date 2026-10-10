package com.presales.pipeline.importing;

import com.presales.pipeline.importing.dto.ImportIssue;
import java.util.List;
import java.util.Map;

public class ImportValidationException extends RuntimeException {
    private final List<ImportIssue> issues;
    private final Map<String, Object> effectiveFields;

    public ImportValidationException(List<ImportIssue> issues, Map<String, Object> effectiveFields) {
        super(issues.stream().map(ImportIssue::message).collect(java.util.stream.Collectors.joining("；")));
        this.issues = List.copyOf(issues);
        this.effectiveFields = effectiveFields;
    }
    public List<ImportIssue> getIssues() { return issues; }
    public Map<String, Object> getEffectiveFields() { return effectiveFields; }
}
