package com.presales.pipeline.exporting;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.common.validation.MonthUtils;
import com.presales.pipeline.config.ConfigService;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import com.presales.pipeline.config.ExportScope;
import com.presales.pipeline.config.ExportTemplate;
import com.presales.pipeline.config.dto.ExportColumnRequest;
import com.presales.pipeline.exporting.dto.ExportFieldResponse;
import com.presales.pipeline.exporting.dto.ExportFilters;
import com.presales.pipeline.exporting.dto.ExportRequest;
import com.presales.pipeline.exporting.dto.ExportResponse;
import com.presales.pipeline.progress.ProgressLog;
import com.presales.pipeline.progress.ProgressLogRepository;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.revenue.Revenue;
import com.presales.pipeline.revenue.RevenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ExportService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");
    private static final Map<String, List<ExportFieldResponse>> STANDARD_FIELDS = Map.of(
            ExportScope.COMBINED, List.of(
                    field("id", "项目ID"), field("externalId", "外部系统编号"), field("customerName", "客户名称"),
                    field("projectName", "项目名称"), field("projectStatus", "项目状态"),
                    field("safetySpace", "安全空间"), field("solution", "解决方案"),
                    field("subSolution", "细分解决方案"), field("purchasedProducts", "已购产品"),
                    field("track", "赛道"), field("industry", "行业"), field("subIndustry", "子行业"),
                    field("scenario", "场景"), field("keyRisks", "关键风险"), field("keyNeeds", "关键需求")
            ),
            ExportScope.PROJECTS, List.of(
                    field("id", "项目ID"), field("externalId", "外部系统编号"), field("customerName", "客户名称"),
                    field("projectName", "项目名称"), field("projectStatus", "项目状态"),
                    field("safetySpace", "安全空间"), field("solution", "解决方案"),
                    field("subSolution", "细分解决方案"), field("purchasedProducts", "已购产品"),
                    field("track", "赛道"), field("industry", "行业"), field("subIndustry", "子行业"),
                    field("scenario", "场景"), field("keyRisks", "关键风险"), field("keyNeeds", "关键需求"),
                    field("revenueTotal", "收入合计（万元）"), field("createdAt", "创建时间"), field("updatedAt", "更新时间")
            ),
            ExportScope.REVENUES, List.of(
                    field("projectId", "项目ID"), field("externalId", "外部系统编号"), field("customerName", "客户名称"),
                    field("projectName", "项目名称"), field("industry", "行业"), field("track", "赛道"),
                    field("month", "月份"), field("amount", "收入（万元）")
            ),
            ExportScope.PROGRESS, List.of(
                    field("projectId", "项目ID"), field("externalId", "外部系统编号"), field("customerName", "客户名称"),
                    field("projectName", "项目名称"), field("industry", "行业"), field("track", "赛道"),
                    field("logDate", "进展日期"), field("content", "进展内容"), field("createdAt", "录入时间")
            )
    );

    private final ConfigService configService;
    private final CustomFieldDefinitionRepository customFieldRepository;
    private final ProjectRepository projectRepository;
    private final RevenueRepository revenueRepository;
    private final ProgressLogRepository progressRepository;

    public ExportService(ConfigService configService,
                         CustomFieldDefinitionRepository customFieldRepository,
                         ProjectRepository projectRepository,
                         RevenueRepository revenueRepository,
                         ProgressLogRepository progressRepository) {
        this.configService = configService;
        this.customFieldRepository = customFieldRepository;
        this.projectRepository = projectRepository;
        this.revenueRepository = revenueRepository;
        this.progressRepository = progressRepository;
    }

    @Transactional(readOnly = true)
    public List<ExportFieldResponse> availableFields(String requestedScope) {
        String scope = ExportScope.normalize(requestedScope);
        List<ExportFieldResponse> fields = new ArrayList<>(STANDARD_FIELDS.get(scope));
        if (ExportScope.COMBINED.equals(scope)) {
            revenueRepository.findActiveInRange(null, null).stream()
                    .map(Revenue::getMonth)
                    .distinct()
                    .sorted()
                    .forEach(month -> fields.add(field("revenue." + month, month + "收入（万元）")));
            fields.add(field("revenueTotal", "收入合计（万元）"));
            fields.add(field("progressSummary", "进展日志（日期：内容）"));
            fields.add(field("createdAt", "创建时间"));
            fields.add(field("updatedAt", "更新时间"));
        }
        if (ExportScope.PROJECTS.equals(scope) || ExportScope.COMBINED.equals(scope)) {
            customFieldRepository.findAllByDeletedFalseOrderBySortOrderAscIdAsc().forEach(definition ->
                    fields.add(field("custom." + definition.getFieldKey(), definition.getLabel())));
        }
        return fields;
    }

    @Transactional(readOnly = true)
    public ExportResponse export(ExportRequest request) {
        ResolvedExport resolved = resolve(request);
        ExportFilters filters = request.filters() == null
                ? new ExportFilters(null, null, null, null, null, null, null, null)
                : request.filters();
        String startMonth = MonthUtils.validateNullable(filters.startMonth(), "开始月份");
        String endMonth = MonthUtils.validateNullable(filters.endMonth(), "结束月份");
        MonthUtils.validateRange(startMonth, endMonth);
        if (filters.startDate() != null && filters.endDate() != null
                && filters.startDate().isAfter(filters.endDate())) {
            throw BusinessException.badRequest("开始日期不能晚于结束日期");
        }

        List<Map<String, Object>> rows = switch (resolved.scope()) {
            case ExportScope.COMBINED -> combinedRows(resolved.columns(), filters, startMonth, endMonth);
            case ExportScope.PROJECTS -> projectRows(resolved.columns(), filters, startMonth, endMonth);
            case ExportScope.REVENUES -> revenueRows(resolved.columns(), filters, startMonth, endMonth);
            case ExportScope.PROGRESS -> progressRows(resolved.columns(), filters);
            default -> throw BusinessException.badRequest("未知导出范围");
        };
        return new ExportResponse(resolved.scope(), resolved.columns(), rows, rows.size(),
                LocalDateTime.now(BUSINESS_ZONE));
    }

    private ResolvedExport resolve(ExportRequest request) {
        String scope;
        List<ExportColumnRequest> columns;
        if (request.templateId() != null) {
            ExportTemplate template = configService.getExportTemplateEntity(request.templateId());
            scope = template.getScope();
            columns = template.getColumns().stream()
                    .map(column -> new ExportColumnRequest(String.valueOf(column.get("key")), String.valueOf(column.get("title"))))
                    .toList();
        } else {
            scope = ExportScope.normalize(request.scope());
            columns = request.columns();
        }
        if (columns == null || columns.isEmpty()) {
            throw BusinessException.badRequest("至少选择一个导出列");
        }
        Set<String> allowed = availableFields(scope).stream().map(ExportFieldResponse::key)
                .collect(Collectors.toSet());
        Set<String> seen = new HashSet<>();
        for (ExportColumnRequest column : columns) {
            if (column == null || column.key() == null || column.key().isBlank()
                    || column.title() == null || column.title().isBlank()) {
                throw BusinessException.badRequest("导出列的字段和列名不能为空");
            }
            if (!allowed.contains(column.key()) && !ExportScope.isRevenueMonthField(scope, column.key())) {
                throw BusinessException.badRequest("当前范围不支持导出字段：" + column.key());
            }
            if (!seen.add(column.key())) {
                throw BusinessException.badRequest("导出字段不能重复：" + column.key());
            }
        }
        return new ResolvedExport(scope, columns);
    }

    private List<Map<String, Object>> combinedRows(List<ExportColumnRequest> columns,
                                                    ExportFilters filters,
                                                    String startMonth,
                                                    String endMonth) {
        List<Project> projects = filteredProjects(filters);
        Set<Long> ids = projects.stream().map(Project::getId).collect(Collectors.toSet());
        Map<Long, Map<String, BigDecimal>> monthlyRevenue = new HashMap<>();
        Map<Long, BigDecimal> totals = new HashMap<>();
        for (Revenue revenue : revenueRepository.findActiveInRange(startMonth, endMonth)) {
            Long projectId = revenue.getProject().getId();
            if (!ids.contains(projectId)) {
                continue;
            }
            monthlyRevenue.computeIfAbsent(projectId, ignored -> new HashMap<>())
                    .put(revenue.getMonth(), revenue.getAmount());
            totals.merge(projectId, revenue.getAmount(), BigDecimal::add);
        }

        Map<Long, List<ProgressLog>> progressByProject = progressRepository.findAllActiveWithProject().stream()
                .filter(log -> ids.contains(log.getProject().getId()))
                .filter(log -> inProgressRange(log, filters, startMonth, endMonth))
                .collect(Collectors.groupingBy(log -> log.getProject().getId(), LinkedHashMap::new, Collectors.toList()));

        return projects.stream().map(project -> row(columns, key -> {
            if (ExportScope.isRevenueMonthField(ExportScope.COMBINED, key)) {
                return monthlyRevenue.getOrDefault(project.getId(), Map.of())
                        .get(key.substring("revenue.".length()));
            }
            if ("progressSummary".equals(key)) {
                return progressByProject.getOrDefault(project.getId(), List.of()).stream()
                        .map(log -> log.getLogDate() + "：" + log.getContent())
                        .collect(Collectors.joining("\n"));
            }
            return projectValue(project, totals.getOrDefault(project.getId(), BigDecimal.ZERO), key);
        })).toList();
    }

    private boolean inProgressRange(ProgressLog log,
                                    ExportFilters filters,
                                    String startMonth,
                                    String endMonth) {
        String month = log.getLogDate().toString().substring(0, 7);
        return (startMonth == null || month.compareTo(startMonth) >= 0)
                && (endMonth == null || month.compareTo(endMonth) <= 0)
                && (filters.startDate() == null || !log.getLogDate().isBefore(filters.startDate()))
                && (filters.endDate() == null || !log.getLogDate().isAfter(filters.endDate()));
    }

    private List<Map<String, Object>> projectRows(List<ExportColumnRequest> columns,
                                                   ExportFilters filters,
                                                   String startMonth,
                                                   String endMonth) {
        List<Project> projects = filteredProjects(filters);
        Set<Long> ids = projects.stream().map(Project::getId).collect(Collectors.toSet());
        Map<Long, BigDecimal> totals = new HashMap<>();
        for (Revenue revenue : revenueRepository.findActiveInRange(startMonth, endMonth)) {
            if (ids.contains(revenue.getProject().getId())) {
                totals.merge(revenue.getProject().getId(), revenue.getAmount(), BigDecimal::add);
            }
        }
        return projects.stream().map(project -> row(columns,
                key -> projectValue(project, totals.getOrDefault(project.getId(), BigDecimal.ZERO), key))).toList();
    }

    private List<Map<String, Object>> revenueRows(List<ExportColumnRequest> columns,
                                                   ExportFilters filters,
                                                   String startMonth,
                                                   String endMonth) {
        Set<Long> ids = filteredProjects(filters).stream().map(Project::getId)
                .collect(Collectors.toSet());
        return revenueRepository.findActiveInRange(startMonth, endMonth).stream()
                .filter(revenue -> ids.contains(revenue.getProject().getId()))
                .map(revenue -> row(columns, key -> revenueValue(revenue, key)))
                .toList();
    }

    private List<Map<String, Object>> progressRows(List<ExportColumnRequest> columns, ExportFilters filters) {
        Set<Long> ids = filteredProjects(filters).stream().map(Project::getId)
                .collect(Collectors.toSet());
        return progressRepository.findAllActiveWithProject().stream()
                .filter(log -> ids.contains(log.getProject().getId()))
                .filter(log -> filters.startDate() == null || !log.getLogDate().isBefore(filters.startDate()))
                .filter(log -> filters.endDate() == null || !log.getLogDate().isAfter(filters.endDate()))
                .map(log -> row(columns, key -> progressValue(log, key)))
                .toList();
    }

    private List<Project> filteredProjects(ExportFilters filters) {
        Set<Long> selectedIds = filters.projectIds() == null
                ? Set.of() : new LinkedHashSet<>(filters.projectIds());
        String keyword = filters.keyword() == null ? null : filters.keyword().trim().toLowerCase(Locale.ROOT);
        return projectRepository.findAllByDeletedFalseOrderByIdAsc().stream()
                .filter(project -> selectedIds.isEmpty() || selectedIds.contains(project.getId()))
                .filter(project -> filters.industry() == null || filters.industry().isBlank()
                        || filters.industry().trim().equals(project.getIndustry()))
                .filter(project -> filters.track() == null || filters.track().isBlank()
                        || filters.track().trim().equals(project.getTrack()))
                .filter(project -> keyword == null || keyword.isBlank()
                        || project.getCustomerName().toLowerCase(Locale.ROOT).contains(keyword)
                        || project.getProjectName().toLowerCase(Locale.ROOT).contains(keyword))
                .toList();
    }

    private Map<String, Object> row(List<ExportColumnRequest> columns,
                                    java.util.function.Function<String, Object> valueProvider) {
        Map<String, Object> row = new LinkedHashMap<>();
        for (ExportColumnRequest column : columns) {
            row.put(column.key(), valueProvider.apply(column.key()));
        }
        return row;
    }

    private Object projectValue(Project project, BigDecimal total, String key) {
        if (key.startsWith("custom.")) {
            return project.getCustomFields().get(key.substring("custom.".length()));
        }
        return switch (key) {
            case "id" -> project.getId();
            case "externalId" -> project.getExternalId();
            case "customerName" -> project.getCustomerName();
            case "projectName" -> project.getProjectName();
            case "projectStatus" -> project.getProjectStatus();
            case "safetySpace" -> project.getSafetySpace();
            case "solution" -> project.getSolution();
            case "subSolution" -> project.getSubSolution();
            case "purchasedProducts" -> String.join("、", project.getPurchasedProducts());
            case "track" -> project.getTrack();
            case "industry" -> project.getIndustry();
            case "subIndustry" -> project.getSubIndustry();
            case "scenario" -> project.getScenario();
            case "keyRisks" -> project.getKeyRisks();
            case "keyNeeds" -> project.getKeyNeeds();
            case "revenueTotal" -> total;
            case "createdAt" -> project.getCreatedAt();
            case "updatedAt" -> project.getUpdatedAt();
            default -> null;
        };
    }

    private Object revenueValue(Revenue revenue, String key) {
        Project project = revenue.getProject();
        return switch (key) {
            case "projectId" -> project.getId();
            case "externalId" -> project.getExternalId();
            case "customerName" -> project.getCustomerName();
            case "projectName" -> project.getProjectName();
            case "industry" -> project.getIndustry();
            case "track" -> project.getTrack();
            case "month" -> revenue.getMonth();
            case "amount" -> revenue.getAmount();
            default -> null;
        };
    }

    private Object progressValue(ProgressLog log, String key) {
        Project project = log.getProject();
        return switch (key) {
            case "projectId" -> project.getId();
            case "externalId" -> project.getExternalId();
            case "customerName" -> project.getCustomerName();
            case "projectName" -> project.getProjectName();
            case "industry" -> project.getIndustry();
            case "track" -> project.getTrack();
            case "logDate" -> log.getLogDate();
            case "content" -> log.getContent();
            case "createdAt" -> log.getCreatedAt();
            default -> null;
        };
    }

    private static ExportFieldResponse field(String key, String title) {
        return new ExportFieldResponse(key, title);
    }

    private record ResolvedExport(String scope, List<ExportColumnRequest> columns) {
    }
}
