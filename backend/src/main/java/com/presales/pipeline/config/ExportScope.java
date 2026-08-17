package com.presales.pipeline.config;

import com.presales.pipeline.common.exception.BusinessException;

import java.util.Locale;
import java.util.Set;

public final class ExportScope {

    public static final String PROJECTS = "projects";
    public static final String REVENUES = "revenues";
    public static final String PROGRESS = "progress";
    private static final Set<String> ALLOWED = Set.of(PROJECTS, REVENUES, PROGRESS);

    private ExportScope() {
    }

    public static String normalize(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED.contains(normalized)) {
            throw BusinessException.badRequest("导出范围仅支持 projects、revenues 或 progress");
        }
        return normalized;
    }
}
