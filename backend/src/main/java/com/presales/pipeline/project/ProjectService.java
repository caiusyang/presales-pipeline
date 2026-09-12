package com.presales.pipeline.project;

import com.presales.pipeline.audit.ChangeLog;
import com.presales.pipeline.audit.ChangeLogRepository;
import com.presales.pipeline.audit.ChangeLogService;
import com.presales.pipeline.audit.dto.ChangeLogResponse;
import com.presales.pipeline.common.api.PageData;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.common.validation.MonthUtils;
import com.presales.pipeline.config.ConfigService;
import com.presales.pipeline.dictionary.DictionaryService;
import com.presales.pipeline.progress.ProgressLog;
import com.presales.pipeline.progress.ProgressLogRepository;
import com.presales.pipeline.progress.dto.ProgressResponse;
import com.presales.pipeline.project.dto.ProjectDetailResponse;
import com.presales.pipeline.project.dto.ProjectRequest;
import com.presales.pipeline.project.dto.ProjectResponse;
import com.presales.pipeline.revenue.Revenue;
import com.presales.pipeline.revenue.RevenueRepository;
import com.presales.pipeline.revenue.dto.RevenueResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class ProjectService {

    public static final String DEFAULT_STATUS = "机会点识别";
    public static final String WON_STATUS = "中标";
    public static final List<String> PROJECT_STATUSES = List.of("机会点识别", "方案引导", "方案设计", WON_STATUS);

    private static final Map<String, String> SORT_FIELDS = Map.of(
            "id", "id",
            "customerName", "customerName",
            "projectName", "projectName",
            "projectStatus", "projectStatus",
            "industry", "industry",
            "track", "track",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt"
    );

    private final ProjectRepository projectRepository;
    private final RevenueRepository revenueRepository;
    private final ProgressLogRepository progressRepository;
    private final ChangeLogRepository changeLogRepository;
    private final ChangeLogService changeLogService;
    private final ConfigService configService;
    private final DictionaryService dictionaryService;

    public ProjectService(ProjectRepository projectRepository,
                          RevenueRepository revenueRepository,
                          ProgressLogRepository progressRepository,
                          ChangeLogRepository changeLogRepository,
                          ChangeLogService changeLogService,
                          ConfigService configService,
                          DictionaryService dictionaryService) {
        this.projectRepository = projectRepository;
        this.revenueRepository = revenueRepository;
        this.progressRepository = progressRepository;
        this.changeLogRepository = changeLogRepository;
        this.changeLogService = changeLogService;
        this.configService = configService;
        this.dictionaryService = dictionaryService;
    }

    @Transactional(readOnly = true)
    public PageData<ProjectResponse> list(String industry,
                                          String track,
                                          String projectStatus,
                                          String keyword,
                                          String startMonth,
                                          String endMonth,
                                          int page,
                                          int size,
                                          String sortBy,
                                          String sortDirection,
                                          boolean deleted) {
        String start = MonthUtils.validateNullable(startMonth, "开始月份");
        String end = MonthUtils.validateNullable(endMonth, "结束月份");
        MonthUtils.validateRange(start, end);
        if (page < 0) {
            throw BusinessException.badRequest("页码不能小于 0");
        }
        if (size < 1 || size > 200) {
            throw BusinessException.badRequest("每页数量必须在 1 到 200 之间");
        }
        String property = SORT_FIELDS.getOrDefault(sortBy, "updatedAt");
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Page<Project> result = projectRepository.findAll(
                ProjectSpecifications.filter(industry, track, projectStatus, keyword, start, end, deleted),
                PageRequest.of(page, size, Sort.by(direction, property)));

        List<Long> ids = result.getContent().stream().map(Project::getId).toList();
        Map<Long, BigDecimal> totals = revenueTotals(ids, start, end);
        List<ProjectResponse> items = result.getContent().stream()
                .map(project -> toResponse(project, totals.getOrDefault(project.getId(), BigDecimal.ZERO)))
                .toList();
        return PageData.from(result, items);
    }

    @Transactional(readOnly = true)
    public ProjectDetailResponse detail(Long id) {
        Project project = getActiveEntity(id);
        List<Revenue> revenues = revenueRepository.findAllByProjectIdAndDeletedFalseOrderByMonthAsc(id);
        BigDecimal total = revenues.stream().map(Revenue::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<ProgressResponse> progress = progressRepository
                .findAllByProjectIdAndDeletedFalseOrderByLogDateDescIdDesc(id).stream()
                .map(this::toProgressResponse).toList();
        List<RevenueResponse> revenueItems = revenues.stream().map(this::toRevenueResponse).toList();
        List<ChangeLogResponse> changes = changeLogRepository.findAllByProjectIdOrderByCreatedAtDescIdDesc(id).stream()
                .map(this::toChangeLogResponse).toList();
        return new ProjectDetailResponse(toResponse(project, total), progress, revenueItems, changes);
    }

    @Transactional
    public ProjectResponse create(ProjectRequest request) {
        Project project = createEntity(request, ChangeLogService.SOURCE_MANUAL);
        return toResponse(project, BigDecimal.ZERO);
    }

    @Transactional
    public ProjectResponse update(Long id, ProjectRequest request) {
        Project project = getActiveEntity(id);
        applyUpdate(project, request, ChangeLogService.SOURCE_MANUAL);
        BigDecimal total = revenueRepository.findAllByProjectIdAndDeletedFalseOrderByMonthAsc(id).stream()
                .map(Revenue::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return toResponse(project, total);
    }

    @Transactional
    public void delete(Long id) {
        Project project = getActiveEntity(id);
        changeLogService.log(project, "deleted", false, true, ChangeLogService.SOURCE_MANUAL);
        project.setDeleted(true);
    }

    @Transactional
    public ProjectResponse restore(Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("项目不存在"));
        if (!project.isDeleted()) {
            return toResponse(project, totalRevenue(project.getId()));
        }
        if (projectRepository.existsByCustomerNameIgnoreCaseAndProjectNameIgnoreCaseAndDeletedFalseAndIdNot(
                project.getCustomerName(), project.getProjectName(), project.getId())) {
            throw BusinessException.conflict("已有同客户、同项目名称的活动项目，无法恢复");
        }
        changeLogService.log(project, "deleted", true, false, ChangeLogService.SOURCE_MANUAL);
        project.setDeleted(false);
        return toResponse(project, totalRevenue(project.getId()));
    }

    @Transactional(readOnly = true)
    public Project getActiveEntity(Long id) {
        return projectRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> BusinessException.notFound("项目不存在"));
    }

    @Transactional
    public Project createEntity(ProjectRequest request, String source) {
        NormalizedProject normalized = normalizeAndValidate(request, null);
        Project project = new Project();
        setAll(project, normalized);
        projectRepository.save(project);
        changeLogService.log(project, "project", null, "created", source);
        return project;
    }

    @Transactional
    public void applyUpdate(Project project, ProjectRequest request, String source) {
        NormalizedProject normalized = normalizeAndValidate(request, project.getId());
        changeAndSet(project, "externalId", project.getExternalId(), normalized.externalId(), project::setExternalId, source);
        changeAndSet(project, "customerName", project.getCustomerName(), normalized.customerName(), project::setCustomerName, source);
        changeAndSet(project, "projectName", project.getProjectName(), normalized.projectName(), project::setProjectName, source);
        changeAndSet(project, "projectStatus", project.getProjectStatus(), normalized.projectStatus(), project::setProjectStatus, source);
        changeAndSet(project, "safetySpace", project.getSafetySpace(), normalized.safetySpace(), project::setSafetySpace, source);
        changeAndSet(project, "solution", project.getSolution(), normalized.solution(), project::setSolution, source);
        changeAndSet(project, "subSolution", project.getSubSolution(), normalized.subSolution(), project::setSubSolution, source);
        if (changeLogService.logIfChanged(project, "purchasedProducts", project.getPurchasedProducts(),
                normalized.purchasedProducts(), source)) {
            project.setPurchasedProducts(normalized.purchasedProducts());
        }
        changeAndSet(project, "track", project.getTrack(), normalized.track(), project::setTrack, source);
        changeAndSet(project, "industry", project.getIndustry(), normalized.industry(), project::setIndustry, source);
        changeAndSet(project, "subIndustry", project.getSubIndustry(), normalized.subIndustry(), project::setSubIndustry, source);
        changeAndSet(project, "scenario", project.getScenario(), normalized.scenario(), project::setScenario, source);
        changeAndSet(project, "keyRisks", project.getKeyRisks(), normalized.keyRisks(), project::setKeyRisks, source);
        changeAndSet(project, "keyNeeds", project.getKeyNeeds(), normalized.keyNeeds(), project::setKeyNeeds, source);

        Set<String> customKeys = new LinkedHashSet<>(project.getCustomFields().keySet());
        customKeys.addAll(normalized.customFields().keySet());
        for (String key : customKeys) {
            changeLogService.logIfChanged(project, "custom." + key,
                    project.getCustomFields().get(key), normalized.customFields().get(key), source);
        }
        project.setCustomFields(normalized.customFields());
    }

    @Transactional(readOnly = true)
    public void validate(ProjectRequest request, Long currentId) {
        normalizeAndValidate(request, currentId);
    }

    public ProjectResponse toResponse(Project project, BigDecimal revenueTotal) {
        return new ProjectResponse(project.getId(), project.getExternalId(), project.getCustomerName(),
                project.getProjectName(), project.getProjectStatus(), project.getSafetySpace(), project.getSolution(),
                project.getSubSolution(), project.getPurchasedProducts(), project.getTrack(),
                project.getIndustry(), project.getSubIndustry(), project.getScenario(), project.getKeyRisks(),
                project.getKeyNeeds(), project.getCustomFields(), revenueTotal, project.isDeleted(),
                project.getCreatedAt(), project.getUpdatedAt());
    }

    private NormalizedProject normalizeAndValidate(ProjectRequest request, Long currentId) {
        String externalId = cleanNullable(request.externalId());
        String customerName = request.customerName().trim();
        String projectName = request.projectName().trim();
        String projectStatus = cleanNullable(request.projectStatus());
        if (projectStatus == null) {
            projectStatus = DEFAULT_STATUS;
        }
        if (!PROJECT_STATUSES.contains(projectStatus)) {
            throw BusinessException.badRequest("项目状态只能是：" + String.join("、", PROJECT_STATUSES));
        }
        if (externalId != null && projectRepository.existsByExternalIdAndIdNot(externalId, idOrSentinel(currentId))) {
            throw BusinessException.conflict("外部系统编号已被其他项目使用");
        }
        if (projectRepository.existsByCustomerNameIgnoreCaseAndProjectNameIgnoreCaseAndDeletedFalseAndIdNot(
                customerName, projectName, idOrSentinel(currentId))) {
            throw BusinessException.conflict("同一客户下已存在同名项目");
        }

        String safetySpace = cleanNullable(request.safetySpace());
        String solution = cleanNullable(request.solution());
        String subSolution = cleanNullable(request.subSolution());
        List<String> purchasedProducts = normalizeProducts(request.purchasedProducts());
        String track = cleanNullable(request.track());
        String industry = cleanNullable(request.industry());
        String subIndustry = cleanNullable(request.subIndustry());
        dictionaryService.validateProjectSelections(safetySpace, solution, subSolution, purchasedProducts,
                track, industry, subIndustry);
        if (WON_STATUS.equals(projectStatus)) {
            if (solution == null) {
                throw BusinessException.badRequest("中标时必须确认解决方案");
            }
            if (subSolution == null) {
                throw BusinessException.badRequest("中标时必须确认细分解决方案");
            }
            if (purchasedProducts.isEmpty()) {
                throw BusinessException.badRequest("中标时至少选择一个已购产品");
            }
        }
        Map<String, Object> customFields = configService.normalizeAndValidateCustomFields(request.customFields());

        return new NormalizedProject(externalId, customerName, projectName, projectStatus, safetySpace, solution,
                subSolution, purchasedProducts, track,
                industry, subIndustry, cleanNullable(request.scenario()), cleanNullable(request.keyRisks()),
                cleanNullable(request.keyNeeds()), customFields);
    }

    private long idOrSentinel(Long id) {
        return id == null ? -1L : id;
    }

    private void setAll(Project project, NormalizedProject value) {
        project.setExternalId(value.externalId());
        project.setCustomerName(value.customerName());
        project.setProjectName(value.projectName());
        project.setProjectStatus(value.projectStatus());
        project.setSafetySpace(value.safetySpace());
        project.setSolution(value.solution());
        project.setSubSolution(value.subSolution());
        project.setPurchasedProducts(value.purchasedProducts());
        project.setTrack(value.track());
        project.setIndustry(value.industry());
        project.setSubIndustry(value.subIndustry());
        project.setScenario(value.scenario());
        project.setKeyRisks(value.keyRisks());
        project.setKeyNeeds(value.keyNeeds());
        project.setCustomFields(value.customFields());
    }

    private void changeAndSet(Project project, String field, String oldValue, String newValue,
                              java.util.function.Consumer<String> setter, String source) {
        if (changeLogService.logIfChanged(project, field, oldValue, newValue, source)) {
            setter.accept(newValue);
        }
    }

    private Map<Long, BigDecimal> revenueTotals(List<Long> projectIds, String startMonth, String endMonth) {
        Map<Long, BigDecimal> totals = new HashMap<>();
        if (projectIds.isEmpty()) {
            return totals;
        }
        for (Revenue revenue : revenueRepository.findAllByProjectIdInAndDeletedFalse(projectIds)) {
            if ((startMonth == null || revenue.getMonth().compareTo(startMonth) >= 0)
                    && (endMonth == null || revenue.getMonth().compareTo(endMonth) <= 0)) {
                totals.merge(revenue.getProject().getId(), revenue.getAmount(), BigDecimal::add);
            }
        }
        return totals;
    }

    private BigDecimal totalRevenue(Long projectId) {
        return revenueRepository.findAllByProjectIdAndDeletedFalseOrderByMonthAsc(projectId).stream()
                .map(Revenue::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String cleanNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private List<String> normalizeProducts(List<String> values) {
        if (values == null) {
            return List.of();
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String value : values) {
            String cleaned = cleanNullable(value);
            if (cleaned != null) {
                normalized.add(cleaned);
            }
        }
        return List.copyOf(normalized);
    }

    private ProgressResponse toProgressResponse(ProgressLog log) {
        return new ProgressResponse(log.getId(), log.getProject().getId(), log.getLogDate(), log.getContent(),
                log.getCreatedAt(), log.getUpdatedAt());
    }

    private RevenueResponse toRevenueResponse(Revenue revenue) {
        return new RevenueResponse(revenue.getId(), revenue.getProject().getId(), revenue.getMonth(),
                revenue.getAmount(), revenue.getCreatedAt(), revenue.getUpdatedAt());
    }

    private ChangeLogResponse toChangeLogResponse(ChangeLog log) {
        return new ChangeLogResponse(log.getId(), log.getOperator(), log.getField(), log.getOldValue(),
                log.getNewValue(), log.getSource(), log.getCreatedAt());
    }

    private record NormalizedProject(
            String externalId,
            String customerName,
            String projectName,
            String projectStatus,
            String safetySpace,
            String solution,
            String subSolution,
            List<String> purchasedProducts,
            String track,
            String industry,
            String subIndustry,
            String scenario,
            String keyRisks,
            String keyNeeds,
            Map<String, Object> customFields
    ) {
    }
}
