package com.presales.pipeline.common.validation;

import com.presales.pipeline.common.exception.BusinessException;

import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.stream.IntStream;

public final class MonthUtils {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");

    private MonthUtils() {
    }

    public static String validateNullable(String month, String label) {
        if (month == null || month.isBlank()) {
            return null;
        }
        String normalized = month.trim();
        try {
            YearMonth.parse(normalized, FORMATTER);
        } catch (DateTimeParseException exception) {
            throw BusinessException.badRequest(label + "必须使用 YYYY-MM 格式");
        }
        return normalized;
    }

    public static String validateRequired(String month) {
        String value = validateNullable(month, "月份");
        if (value == null) {
            throw BusinessException.badRequest("月份不能为空");
        }
        return value;
    }

    public static void validateRange(String startMonth, String endMonth) {
        if (startMonth != null && endMonth != null && startMonth.compareTo(endMonth) > 0) {
            throw BusinessException.badRequest("开始月份不能晚于结束月份");
        }
    }

    public static List<String> monthsOfYear(int year) {
        if (year < 2000 || year > 2100) {
            throw BusinessException.badRequest("年份必须在 2000 到 2100 之间");
        }
        return IntStream.rangeClosed(1, 12)
                .mapToObj(month -> "%04d-%02d".formatted(year, month))
                .toList();
    }
}
