package com.presales.pipeline.revenue;

import com.presales.pipeline.audit.ChangeLogService;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.common.validation.MonthUtils;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.project.ProjectService;
import com.presales.pipeline.revenue.dto.RevenueBatchRequest;
import com.presales.pipeline.revenue.dto.RevenueBatchResponse;
import com.presales.pipeline.revenue.dto.RevenueEntryRequest;
import com.presales.pipeline.revenue.dto.RevenueMatrixResponse;
import com.presales.pipeline.revenue.dto.RevenueMatrixRow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class RevenueService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");

    private final RevenueRepository revenueRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final ChangeLogService changeLogService;

    public RevenueService(RevenueRepository revenueRepository,
                          ProjectRepository projectRepository,
                          ProjectService projectService,
                          ChangeLogService changeLogService) {
        this.revenueRepository = revenueRepository;
        this.projectRepository = projectRepository;
        this.projectService = projectService;
        this.changeLogService = changeLogService;
    }

    @Transactional(readOnly = true)
    public RevenueMatrixResponse matrix(Integer year,
                                        String startMonth,
                                        String endMonth,
                                        String industry,
                                        String track,
                                        String keyword) {
        List<String> months = resolveMonths(year, startMonth, endMonth);
        String start = months.get(0);
        String end = months.get(months.size() - 1);
        String normalizedKeyword = keyword == null ? null : keyword.trim().toLowerCase(Locale.ROOT);

        List<Project> projects = projectRepository.findAllByDeletedFalseOrderByIdAsc().stream()
                .filter(project -> industry == null || industry.isBlank() || industry.trim().equals(project.getIndustry()))
                .filter(project -> track == null || track.isBlank() || track.trim().equals(project.getTrack()))
                .filter(project -> normalizedKeyword == null || normalizedKeyword.isBlank()
                        || project.getCustomerName().toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                        || project.getProjectName().toLowerCase(Locale.ROOT).contains(normalizedKeyword))
                .toList();

        Map<Long, Map<String, BigDecimal>> amountsByProject = new LinkedHashMap<>();
        for (Revenue revenue : revenueRepository.findActiveInRange(start, end)) {
            amountsByProject.computeIfAbsent(revenue.getProject().getId(), ignored -> new LinkedHashMap<>())
                    .put(revenue.getMonth(), revenue.getAmount());
        }

        List<RevenueMatrixRow> rows = projects.stream().map(project -> {
            Map<String, BigDecimal> amounts = amountsByProject.getOrDefault(project.getId(), Map.of());
            BigDecimal total = amounts.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            return new RevenueMatrixRow(project.getId(), project.getCustomerName(), project.getProjectName(),
                    project.getIndustry(), project.getTrack(), amounts, total);
        }).toList();
        return new RevenueMatrixResponse(months, rows);
    }

    @Transactional
    public RevenueBatchResponse saveBatch(RevenueBatchRequest request) {
        Set<String> uniqueCells = new HashSet<>();
        int created = 0;
        int updated = 0;
        int cleared = 0;
        int unchanged = 0;

        for (RevenueEntryRequest entry : request.entries()) {
            String month = MonthUtils.validateRequired(entry.month());
            String cellKey = entry.projectId() + "@" + month;
            if (!uniqueCells.add(cellKey)) {
                throw BusinessException.badRequest("同一批次中存在重复收入单元格：" + cellKey);
            }
            Project project = projectService.getActiveEntity(entry.projectId());
            Mutation mutation = upsert(project, month, entry.amount(), ChangeLogService.SOURCE_MANUAL);
            switch (mutation) {
                case CREATED -> created++;
                case UPDATED -> updated++;
                case CLEARED -> cleared++;
                case UNCHANGED -> unchanged++;
            }
        }
        return new RevenueBatchResponse(created, updated, cleared, unchanged);
    }

    @Transactional
    public Mutation upsert(Project project, String rawMonth, BigDecimal rawAmount, String source) {
        String month = MonthUtils.validateRequired(rawMonth);
        Revenue existing = revenueRepository.findByProjectIdAndMonth(project.getId(), month).orElse(null);

        if (rawAmount == null) {
            if (existing == null || existing.isDeleted()) {
                return Mutation.UNCHANGED;
            }
            changeLogService.log(project, "revenue." + month, existing.getAmount(), null, source);
            existing.setDeleted(true);
            return Mutation.CLEARED;
        }

        BigDecimal amount = normalizeAmount(rawAmount);
        if (existing == null) {
            revenueRepository.save(new Revenue(project, month, amount));
            changeLogService.log(project, "revenue." + month, null, amount, source);
            return Mutation.CREATED;
        }
        if (existing.isDeleted()) {
            existing.setDeleted(false);
            existing.setAmount(amount);
            changeLogService.log(project, "revenue." + month, null, amount, source);
            return Mutation.CREATED;
        }
        if (existing.getAmount().compareTo(amount) == 0) {
            return Mutation.UNCHANGED;
        }
        changeLogService.log(project, "revenue." + month, existing.getAmount(), amount, source);
        existing.setAmount(amount);
        return Mutation.UPDATED;
    }

    public void validateCell(String rawMonth, BigDecimal rawAmount) {
        MonthUtils.validateRequired(rawMonth);
        if (rawAmount != null) {
            normalizeAmount(rawAmount);
        }
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        if (amount.signum() < 0) {
            throw BusinessException.badRequest("收入金额不能为负数");
        }
        try {
            BigDecimal normalized = amount.setScale(2, RoundingMode.UNNECESSARY);
            if (normalized.precision() - normalized.scale() > 16) {
                throw BusinessException.badRequest("收入金额超出允许范围");
            }
            return normalized;
        } catch (ArithmeticException exception) {
            throw BusinessException.badRequest("收入金额最多保留两位小数");
        }
    }

    private List<String> resolveMonths(Integer year, String startMonth, String endMonth) {
        if (year != null && ((startMonth != null && !startMonth.isBlank()) || (endMonth != null && !endMonth.isBlank()))) {
            throw BusinessException.badRequest("year 与月份区间不能同时使用");
        }
        if (year != null) {
            return MonthUtils.monthsOfYear(year);
        }
        String start = MonthUtils.validateNullable(startMonth, "开始月份");
        String end = MonthUtils.validateNullable(endMonth, "结束月份");
        if (start == null && end == null) {
            return MonthUtils.monthsOfYear(Year.now(BUSINESS_ZONE).getValue());
        }
        if (start == null || end == null) {
            throw BusinessException.badRequest("自定义月份区间必须同时提供开始和结束月份");
        }
        MonthUtils.validateRange(start, end);
        List<String> result = new ArrayList<>();
        YearMonth cursor = YearMonth.parse(start);
        YearMonth last = YearMonth.parse(end);
        while (!cursor.isAfter(last)) {
            result.add(cursor.toString());
            if (result.size() > 60) {
                throw BusinessException.badRequest("收入矩阵一次最多展示 60 个月");
            }
            cursor = cursor.plusMonths(1);
        }
        return result;
    }

    public enum Mutation {
        CREATED, UPDATED, CLEARED, UNCHANGED
    }
}
