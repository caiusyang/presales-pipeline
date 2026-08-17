package com.presales.pipeline.stats;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.stats.dto.RevenueStatItem;
import com.presales.pipeline.stats.dto.RevenueStatsResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RevenueStatsService {

    private static final Map<String, DimensionSql> DIMENSIONS = Map.of(
            "project", new DimensionSql("CAST(p.id AS CHAR)",
                    "CONCAT(p.customer_name, ' / ', p.project_name)",
                    "p.id, p.customer_name, p.project_name", "amount DESC, item_key ASC"),
            "industry", new DimensionSql("COALESCE(NULLIF(p.industry, ''), '未分类')",
                    "COALESCE(NULLIF(p.industry, ''), '未分类')",
                    "COALESCE(NULLIF(p.industry, ''), '未分类')", "amount DESC, item_key ASC"),
            "month", new DimensionSql("r.revenue_month", "r.revenue_month", "r.revenue_month", "item_key ASC"),
            "year", new DimensionSql("SUBSTRING(r.revenue_month, 1, 4)", "SUBSTRING(r.revenue_month, 1, 4)",
                    "SUBSTRING(r.revenue_month, 1, 4)", "item_key ASC")
    );

    private final JdbcTemplate jdbcTemplate;

    public RevenueStatsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public RevenueStatsResponse aggregate(String requestedDimension, Integer year) {
        String dimension = requestedDimension == null ? "project"
                : requestedDimension.trim().toLowerCase(Locale.ROOT);
        DimensionSql sqlParts = DIMENSIONS.get(dimension);
        if (sqlParts == null) {
            throw BusinessException.badRequest("统计维度仅支持 project、industry、month、year");
        }
        if (year != null && (year < 2000 || year > 2100)) {
            throw BusinessException.badRequest("年份必须在 2000 到 2100 之间");
        }

        StringBuilder sql = new StringBuilder("SELECT ")
                .append(sqlParts.keyExpression()).append(" AS item_key, ")
                .append(sqlParts.labelExpression()).append(" AS item_label, ")
                .append("SUM(r.amount) AS amount ")
                .append("FROM revenues r JOIN projects p ON p.id = r.project_id ")
                .append("WHERE r.deleted = FALSE AND p.deleted = FALSE ");
        Object[] parameters = new Object[0];
        if (year != null) {
            sql.append("AND r.revenue_month >= ? AND r.revenue_month <= ? ");
            parameters = new Object[]{year + "-01", year + "-12"};
        }
        sql.append("GROUP BY ").append(sqlParts.groupBy()).append(" ORDER BY ").append(sqlParts.orderBy());

        List<RevenueStatItem> items = jdbcTemplate.query(sql.toString(), (resultSet, rowNum) ->
                new RevenueStatItem(resultSet.getString("item_key"), resultSet.getString("item_label"),
                        resultSet.getBigDecimal("amount")), parameters);
        BigDecimal total = items.stream().map(RevenueStatItem::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new RevenueStatsResponse(dimension, year, total, items);
    }

    private record DimensionSql(String keyExpression, String labelExpression, String groupBy, String orderBy) {
    }
}
