package com.presales.pipeline.config;

import com.presales.pipeline.common.exception.BusinessException;

import java.util.Locale;
import java.util.Set;

public final class ExportScope {

    public static final String COMBINED = "combined";
    public static final String PROJECTS = "projects";
    public static final String REVENUES = "revenues";
    public static final String PROGRESS = "progress";
    private static final Set<String> ALLOWED = Set.of(COMBINED, PROJECTS, REVENUES, PROGRESS);

    private ExportScope() {
    }

    public static String normalize(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED.contains(normalized)) {
            throw BusinessException.badRequest("导出范围仅支持 combined、projects、revenues 或 progress");
        }
        return normalized;
    }

    public static boolean isRevenueMonthField(String scope, String key) {
        return COMBINED.equals(scope) && key != null
                && key.matches("revenue\\.\\d{4}-(0[1-9]|1[0-2])");
    }
}
