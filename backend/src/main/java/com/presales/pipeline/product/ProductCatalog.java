package com.presales.pipeline.product;

import com.presales.pipeline.common.exception.BusinessException;

import java.util.LinkedHashSet;
import java.util.List;

/** 当前系统支持的固定产品编码。 */
public final class ProductCatalog {

    public static final String EXPORT_FIELD_PREFIX = "product.";
    public static final List<String> CODES = List.of(
            "AAD", "WAF", "CFW", "ESA", "HSS", "NDR", "DEW", "DSC", "SecMaster",
            "DBSS", "CBH", "安全运营专业服务", "大模型防火墙", "智能体卫士"
    );

    private ProductCatalog() {
    }

    public static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String cleaned = value.trim();
        return CODES.stream()
                .filter(code -> code.equalsIgnoreCase(cleaned))
                .findFirst()
                .orElseThrow(() -> BusinessException.badRequest(
                        "已购产品只能是：" + String.join("、", CODES)));
    }

    public static List<String> normalizeAll(List<String> values) {
        if (values == null) {
            return List.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            String code = normalize(value);
            if (code != null) {
                normalized.add(code);
            }
        }
        return CODES.stream().filter(normalized::contains).toList();
    }

    public static String exportFieldKey(String code) {
        return EXPORT_FIELD_PREFIX + code;
    }

    public static String exportCode(String fieldKey) {
        if (fieldKey == null || !fieldKey.startsWith(EXPORT_FIELD_PREFIX)) {
            return null;
        }
        String code = fieldKey.substring(EXPORT_FIELD_PREFIX.length());
        return CODES.stream().filter(item -> item.equals(code)).findFirst().orElse(null);
    }
}
