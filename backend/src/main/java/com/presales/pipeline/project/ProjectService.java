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
import com.presales.pipeline.product.ProductCatalog;
import com.presales.pipeline.product.ProjectProductService;
import com.presales.pipeline.product.ProjectProductRepository;
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
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class ProjectService {

    public static final String DEFAULT_STATUS = "机会点识别";
    public static final String WON_STATUS = "中标";
    public static final List<String> PROJECT_STATUSES = List.of("机会点识别", "方案引导", "方案设计", WON_STATUS);

    private static final Map<String, String> SORT_FIELDS = Map.of(
            "nextActionDate", "nextActionDate", "lastFollowUpAt", "lastFollowUpAt",
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
    private final ProjectProductService projectProductService;
    private final ProjectProductRepository projectProductRepository;
    private final ProductCatalog productCatalog;
    private final com.presales.pipeline.solution.ProjectSolutions solutions;
    private final com.presales.pipeline.solution.ProjectSolutionRepository solutionRepository;
    private final com.presales.pipeline.people.PeopleService people;
    private final com.presales.pipeline.people.ProjectPersonRepository personRepository;
    private final ProjectIdentityGuard identityGuard;
    private final com.presales.pipeline.migration.MigrationIssueRepository migrationIssues;
    private final com.presales.pipeline.tasks.TaskHistoryService taskHistory;
    private final com.presales.pipeline.followup.FollowUpPolicyService followUpPolicy;

    public ProjectService(ProjectRepository projectRepository,
                          RevenueRepository revenueRepository,
                          ProgressLogRepository progressRepository,
                          ChangeLogRepository changeLogRepository,
                          ChangeLogService changeLogService,
                          ConfigService configService,
                          DictionaryService dictionaryService,
                          ProjectProductService projectProductService,
                          ProjectProductRepository projectProductRepository,com.presales.pipeline.migration.MigrationIssueRepository migrationIssues,ProductCatalog productCatalog,com.presales.pipeline.solution.ProjectSolutions solutions,com.presales.pipeline.solution.ProjectSolutionRepository solutionRepository,com.presales.pipeline.people.PeopleService people,com.presales.pipeline.people.ProjectPersonRepository personRepository,ProjectIdentityGuard identityGuard,com.presales.pipeline.tasks.TaskHistoryService taskHistory,com.presales.pipeline.followup.FollowUpPolicyService followUpPolicy) {
        this.followUpPolicy=followUpPolicy;
        this.taskHistory=taskHistory;
        this.identityGuard=identityGuard;
        this.people=people;this.personRepository=personRepository;
        this.solutions=solutions;this.solutionRepository=solutionRepository;
        this.productCatalog=productCatalog;
        this.migrationIssues=migrationIssues;
        this.projectRepository = projectRepository;
        this.revenueRepository = revenueRepository;
        this.progressRepository = progressRepository;
        this.changeLogRepository = changeLogRepository;
        this.changeLogService = changeLogService;
        this.configService = configService;
        this.dictionaryService = dictionaryService;
        this.projectProductService = projectProductService;
        this.projectProductRepository = projectProductRepository;
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
        return list(industry,track,projectStatus,keyword,startMonth,endMonth,page,size,sortBy,sortDirection,deleted,null);
    }

    @Transactional(readOnly=true)
    public PageData<ProjectResponse> list(String industry,String track,String projectStatus,String keyword,String startMonth,String endMonth,int page,int size,String sortBy,String sortDirection,boolean deleted,String actionRange) {
        return list(industry,track,projectStatus,keyword,startMonth,endMonth,page,size,sortBy,sortDirection,deleted,actionRange,null,null);
    }
    @Transactional(readOnly=true)
    public PageData<ProjectResponse> list(String industry,String track,String projectStatus,String keyword,String startMonth,String endMonth,int page,int size,String sortBy,String sortDirection,boolean deleted,String actionRange,String solution,String subSolution) {
        return list(industry,track,projectStatus,keyword,startMonth,endMonth,page,size,sortBy,sortDirection,deleted,actionRange,solution,subSolution,null,null);
    }
    @Transactional(readOnly=true)
    public PageData<ProjectResponse> list(String industry,String track,String projectStatus,String keyword,String startMonth,String endMonth,int page,int size,String sortBy,String sortDirection,boolean deleted,String actionRange,String solution,String subSolution,Long responsibleId,String hcsStatus) {
        return list(industry,track,projectStatus,keyword,startMonth,endMonth,page,size,sortBy,sortDirection,deleted,actionRange,solution,subSolution,responsibleId,hcsStatus,null,null,null);
    }
    @Transactional(readOnly=true)
    public PageData<ProjectResponse> list(String industry,String track,String projectStatus,String keyword,String startMonth,String endMonth,int page,int size,String sortBy,String sortDirection,boolean deleted,String actionRange,String solution,String subSolution,Long responsibleId,String hcsStatus,String followUpRange,Boolean fixedTarget,String projectLevel) {
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
        boolean actionSort=sortBy==null||sortBy.isBlank()||sortBy.equals("actionPriority");
        var specification=ProjectSpecifications.filter(industry,track,projectStatus,keyword,start,end,deleted).and(ProjectSpecifications.actions(actionRange,actionSort)).and(ProjectSpecifications.solutions(solution,subSolution)).and(ProjectSpecifications.people(responsibleId,hcsStatus));
        specification=specification.and(ProjectSpecifications.followUp(followUpRange,fixedTarget,projectLevel,followUpPolicy.get()));
        Page<Project> result = projectRepository.findAll(specification,actionSort?PageRequest.of(page,size):PageRequest.of(page,size,Sort.by(direction,property).and(Sort.by("id"))));

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
        return new ProjectDetailResponse(toResponse(project, total), progress,
                projectProductService.list(id), revenueItems, changes);
    }

    @Transactional
    public ProjectResponse create(ProjectRequest request) {
        Project project = createEntity(request, ChangeLogService.SOURCE_MANUAL);
        return toResponse(project, BigDecimal.ZERO);
    }

    @Transactional
    public ProjectResponse update(Long id, ProjectRequest request) {
        Project project = getActiveEntityForUpdate(id);
        applyUpdate(project, request, ChangeLogService.SOURCE_MANUAL);
        BigDecimal total = revenueRepository.findAllByProjectIdAndDeletedFalseOrderByMonthAsc(id).stream()
                .map(Revenue::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return toResponse(project, total);
    }

    @Transactional
    public void delete(Long id) {
        Project project = getActiveEntityForUpdate(id);
        changeLogService.log(project, "deleted", false, true, ChangeLogService.SOURCE_MANUAL);
        project.setDeleted(true);
    }

    @Transactional
    public void permanentlyDelete(Long id) {
        Project project = projectRepository.findByIdForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("回收站中未找到该项目"));
        if (!project.isDeleted()) {
            throw BusinessException.conflict("仅允许永久删除回收站中的项目，请先移入回收站");
        }
        // 不按 deleted 过滤：已软删除的子记录也必须物理清理，且先于主表删除。
        taskHistory.record(project,progressRepository.allIdsForProject(id));
        boolean batchPurge=taskHistory.isBatchPurge();
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization(){
            @Override public void afterCommit(){if(batchPurge)return;try{taskHistory.cleanup();}catch(Exception error){org.slf4j.LoggerFactory.getLogger(ProjectService.class).error("项目任务快照清理失败；读取端仍执行脱敏，并在启动或任务结束时重试",error);}}
        });
        revenueRepository.deleteAllByProjectId(id);
        progressRepository.deleteAllByProjectId(id);
        projectProductRepository.deleteAllByProjectId(id);
        migrationIssues.deleteByProject(id);
        solutionRepository.deleteByProject(id);
        personRepository.deleteByProject(id);
        changeLogRepository.deleteAllByProjectId(id);
        projectRepository.delete(project);
        projectRepository.flush();
    }

    @Transactional
    public ProjectResponse restore(Long id) {
        Project project = projectRepository.findByIdForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("项目不存在"));
        if (!project.isDeleted()) {
            return toResponse(project, totalRevenue(project.getId()));
        }
        identityGuard.acquire(project.getCustomerName(),project.getProjectName());
        if (projectRepository.findActiveByNameForUpdate(project.getCustomerName(),project.getProjectName()).filter(p->!p.getId().equals(project.getId())).isPresent()) {
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
    @Transactional public Project getActiveEntityForUpdate(Long id){var project=projectRepository.findByIdForUpdate(id).orElseThrow(()->BusinessException.notFound("项目不存在"));if(project.isDeleted())throw BusinessException.conflict("项目已移入回收站，请刷新后处理");return project;}

    @Transactional
    public Project createEntity(ProjectRequest request, String source) {
        identityGuard.acquire(request.customerName(),request.projectName());
        NormalizedProject normalized = normalizeAndValidate(request, null);
        Project project = new Project();
        project.setFixedTarget(Boolean.TRUE.equals(request.fixedTarget()));project.setProjectLevel(cleanNullable(request.projectLevel()));
        setAll(project, normalized);
        project.setNextActionDate(request.nextActionDate());project.setNextActionNote(cleanNullable(request.nextActionNote()));
        project.setSecurityDirection(cleanNullable(request.securityDirection()));
        project.setHcsOpportunityId(cleanNullable(request.hcsOpportunityId()));
        projectRepository.save(project);
        solutions.sync(project,normalized.solutions());
        people.syncManual(project,request.responsibleIds());
        projectProductService.sync(project, normalized.purchasedProducts());
        changeLogService.log(project, "project", null, "created", source);
        return project;
    }

    @Transactional
    public void applyUpdate(Project project, ProjectRequest request, String source) {
        identityGuard.acquire(request.customerName(),request.projectName());
        NormalizedProject normalized = normalizeAndValidate(request, project.getId());
        if(!Objects.equals(project.getCustomerName(),normalized.customerName())||!Objects.equals(project.getProjectName(),normalized.projectName())||!Objects.equals(project.getExternalId(),normalized.externalId())){
            var beforeIdentity=new LinkedHashMap<String,Object>();beforeIdentity.put("customerName",project.getCustomerName());beforeIdentity.put("projectName",project.getProjectName());beforeIdentity.put("externalId",project.getExternalId());
            var afterIdentity=new LinkedHashMap<String,Object>();afterIdentity.put("customerName",normalized.customerName());afterIdentity.put("projectName",normalized.projectName());afterIdentity.put("externalId",normalized.externalId());
            changeLogService.log(project,"projectIdentity",beforeIdentity,afterIdentity,source);
        }
        var previousSolutions=project.getSolutions();
        if(request.fixedTarget()!=null)changeAndSet(project,"fixedTarget",project.isFixedTarget(),request.fixedTarget(),project::setFixedTarget,source);
        if(request.projectLevel()!=null)changeAndSet(project,"projectLevel",project.getProjectLevel(),cleanNullable(request.projectLevel()),project::setProjectLevel,source);
        if(request.responsibleIds()!=null){var ids=request.responsibleIds().stream().distinct().sorted().toList();if(changeLogService.logIfChanged(project,"responsibleIds",project.getResponsibleIds(),ids,source))people.syncManual(project,ids);}
        if(request.hcsOpportunityId()!=null)changeAndSet(project,"hcsOpportunityId",project.getHcsOpportunityId(),cleanNullable(request.hcsOpportunityId()),project::setHcsOpportunityId,source);
        changeAndSet(project, "externalId", project.getExternalId(), normalized.externalId(), project::setExternalId, source);
        changeAndSet(project, "customerName", project.getCustomerName(), normalized.customerName(), project::setCustomerName, source);
        changeAndSet(project, "projectName", project.getProjectName(), normalized.projectName(), project::setProjectName, source);
        changeAndSet(project, "projectStatus", project.getProjectStatus(), normalized.projectStatus(), project::setProjectStatus, source);
        changeAndSet(project, "securityBudget", project.getSecurityBudget(), normalized.securityBudget(),
                project::setSecurityBudget, source);
        changeAndSet(project, "solution", project.getSolution(), normalized.solution(), project::setSolution, source);
        changeAndSet(project, "subSolution", project.getSubSolution(), normalized.subSolution(), project::setSubSolution, source);
        if(changeLogService.logIfChanged(project,"solutions",previousSolutions,normalized.solutions(),source)||project.solutionLinks().isEmpty())solutions.sync(project,normalized.solutions());
        migrationIssues.findByProjectIdAndArea(project.getId(),"solutions").forEach(issue->issue.resolved=true);
        if (changeLogService.logIfChanged(project, "purchasedProducts", project.getPurchasedProducts(),
                normalized.purchasedProducts(), source)) {
            project.setPurchasedProducts(normalized.purchasedProducts());
            projectProductService.sync(project, normalized.purchasedProducts());
        }
        changeAndSet(project, "track", project.getTrack(), normalized.track(), project::setTrack, source);
        changeAndSet(project,"securityDirection",project.getSecurityDirection(),cleanNullable(request.securityDirection()),project::setSecurityDirection,source);
        if(List.of("HCS","公有云").contains(String.valueOf(normalized.track())))migrationIssues.findByProjectIdAndArea(project.getId(),"track").forEach(issue->issue.resolved=true);
        changeAndSet(project, "industry", project.getIndustry(), normalized.industry(), project::setIndustry, source);
        changeAndSet(project, "subIndustry", project.getSubIndustry(), normalized.subIndustry(), project::setSubIndustry, source);
        changeAndSet(project, "scenario", project.getScenario(), normalized.scenario(), project::setScenario, source);
        changeAndSet(project, "keyRisks", project.getKeyRisks(), normalized.keyRisks(), project::setKeyRisks, source);
        changeAndSet(project, "keyNeeds", project.getKeyNeeds(), normalized.keyNeeds(), project::setKeyNeeds, source);
        changeAndSet(project,"nextActionDate",project.getNextActionDate(),request.nextActionDate(),project::setNextActionDate,source);
        changeAndSet(project,"nextActionNote",project.getNextActionNote(),cleanNullable(request.nextActionNote()),project::setNextActionNote,source);

        Set<String> customKeys = new LinkedHashSet<>(project.getCustomFields().keySet());
        customKeys.addAll(normalized.customFields().keySet());
        for (String key : customKeys) {
            changeLogService.logIfChanged(project, "custom." + key,
                    project.getCustomFields().get(key), normalized.customFields().get(key), source);
        }
        project.setCustomFields(normalized.customFields());
    }

    @Transactional
    public void validate(ProjectRequest request, Long currentId) {
        normalizeAndValidate(request, currentId);
    }

    public ProjectResponse toResponse(Project project, BigDecimal revenueTotal) {
        return new ProjectResponse(project.getId(), project.getExternalId(), project.getCustomerName(),
                project.getProjectName(), project.getProjectStatus(), project.getSecurityBudget(), project.getSolution(),
                project.getSubSolution(), project.getPurchasedProducts(), project.getTrack(),
                project.getIndustry(), project.getSubIndustry(), project.getScenario(), project.getKeyRisks(),
                project.getKeyNeeds(), project.getCustomFields(), revenueTotal, project.isDeleted(),
                project.getCreatedAt(), project.getUpdatedAt(),project.getLastFollowUpAt(),project.getNextActionDate(),project.getNextActionNote(),project.getSecurityDirection(),project.getSolutions(),project.getHcsOpportunityId(),project.getHcsStatus(),project.getLastSyncAt(),project.getResponsibleIds(),project.getResponsibles(),project.isFixedTarget(),project.getProjectLevel());
    }

    @Transactional public ProjectResponse completeAction(Long id,java.time.LocalDate date,String note){
        var project=getActiveEntityForUpdate(id);if(note!=null&&note.length()>20000)throw BusinessException.badRequest("行动内容超过长度限制");
        changeAndSet(project,"nextActionDate",project.getNextActionDate(),date,project::setNextActionDate,ChangeLogService.SOURCE_MANUAL);
        changeAndSet(project,"nextActionNote",project.getNextActionNote(),cleanNullable(note),project::setNextActionNote,ChangeLogService.SOURCE_MANUAL);
        return toResponse(project,totalRevenue(id));
    }

    private NormalizedProject normalizeAndValidate(ProjectRequest request, Long currentId) {
        String level=cleanNullable(request.projectLevel());if(level!=null&&!List.of("无风险","低风险","高风险").contains(level))throw BusinessException.badRequest("项目级别只能为无风险、低风险、高风险");
        var previous=currentId==null?null:projectRepository.findById(currentId).orElseThrow(()->BusinessException.notFound("项目不存在"));
        String externalId = cleanNullable(request.externalId());
        String hcsId=cleanNullable(request.hcsOpportunityId());if(hcsId!=null&&projectRepository.existsByHcsOpportunityIdAndIdNot(hcsId,idOrSentinel(currentId)))throw BusinessException.conflict("HCS机会点编号已被其他项目绑定");
        people.validateManual(previous,request.responsibleIds());
        String customerName = request.customerName().trim();
        String projectName = request.projectName().trim();
        String projectStatus = cleanNullable(request.projectStatus());
        if (projectStatus == null) {
            projectStatus = DEFAULT_STATUS;
        }
        if (!PROJECT_STATUSES.contains(projectStatus)) {
            throw BusinessException.badRequest("项目状态只能是：" + String.join("、", PROJECT_STATUSES));
        }
        if (externalId != null && projectRepository.findByExternalIdForUpdate(externalId).filter(p->!p.getId().equals(idOrSentinel(currentId))).isPresent()) {
            throw BusinessException.conflict("外部系统编号已被其他项目使用");
        }
        if (projectRepository.findActiveByNameForUpdate(customerName,projectName).filter(p->!p.getId().equals(idOrSentinel(currentId))).isPresent()) {
            throw BusinessException.conflict("同一客户下已存在同名项目");
        }

        BigDecimal securityBudget = normalizeSecurityBudget(request.securityBudget());
        var selections=solutions.normalize(request.solutions(),request.solution(),request.subSolution());
        String solution = selections.isEmpty()?null:selections.get(0).solution();
        String subSolution = selections.isEmpty()||selections.get(0).subSolutions().isEmpty()?null:selections.get(0).subSolutions().get(0);
        List<String> purchasedProducts = normalizeProducts(request.purchasedProducts());
        String track = cleanNullable(request.track());
        productCatalog.validateSelections(purchasedProducts,previous==null?List.of():previous.getPurchasedProducts(),track);
        if(track!=null&&!List.of("HCS","公有云").contains(track))throw BusinessException.badRequest("赛道只能选择 HCS 或公有云；旧安全方向请映射到安全方向");
        dictionaryService.validateSecurityDirection(request.securityDirection());
        String industry = cleanNullable(request.industry());
        String subIndustry = cleanNullable(request.subIndustry());
        dictionaryService.validateProjectSelections(solution, subSolution, purchasedProducts,
                track, industry, subIndustry);
        if (WON_STATUS.equals(projectStatus)) {
            if (solution == null) {
                throw BusinessException.badRequest("中标时必须确认解决方案");
            }
            if (selections.stream().noneMatch(selection->!selection.subSolutions().isEmpty())) {
                throw BusinessException.badRequest("中标时必须确认细分解决方案");
            }
            if (purchasedProducts.isEmpty()) {
                throw BusinessException.badRequest("中标时至少选择一个已购产品");
            }
        }
        Map<String, Object> customFields = configService.normalizeAndValidateCustomFields(request.customFields(),track);

        return new NormalizedProject(externalId, customerName, projectName, projectStatus, securityBudget, solution,
                subSolution, purchasedProducts, track,
                industry, subIndustry, cleanNullable(request.scenario()), cleanNullable(request.keyRisks()),
                cleanNullable(request.keyNeeds()), customFields,selections);
    }

    private long idOrSentinel(Long id) {
        return id == null ? -1L : id;
    }

    private void setAll(Project project, NormalizedProject value) {
        project.setExternalId(value.externalId());
        project.setCustomerName(value.customerName());
        project.setProjectName(value.projectName());
        project.setProjectStatus(value.projectStatus());
        project.setSecurityBudget(value.securityBudget());
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

    private <T> void changeAndSet(Project project, String field, T oldValue, T newValue,
                                  java.util.function.Consumer<T> setter, String source) {
        if (changeLogService.logIfChanged(project, field, oldValue, newValue, source)) {
            setter.accept(newValue);
        }
    }

    private Map<Long, BigDecimal> revenueTotals(List<Long> projectIds, String startMonth, String endMonth) {
        Map<Long, BigDecimal> totals = new HashMap<>();
        if (projectIds.isEmpty()) {
            return totals;
        }
        for (var total : revenueRepository.totals(projectIds,startMonth,endMonth)) totals.put(total.getProjectId(),total.getAmount());
        return totals;
    }

    private BigDecimal totalRevenue(Long projectId) {
        return revenueRepository.totals(List.of(projectId),null,null).stream().map(RevenueRepository.Total::getAmount).findFirst().orElse(BigDecimal.ZERO);
    }

    private String cleanNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private BigDecimal normalizeSecurityBudget(BigDecimal value) {
        if (value == null) {
            return null;
        }
        if (value.signum() < 0) {
            throw BusinessException.badRequest("客户安全预算不能为负数");
        }
        try {
            BigDecimal normalized = value.setScale(2, RoundingMode.UNNECESSARY);
            if (normalized.precision() - normalized.scale() > 16) {
                throw BusinessException.badRequest("客户安全预算超出允许范围");
            }
            return normalized;
        } catch (ArithmeticException exception) {
            throw BusinessException.badRequest("客户安全预算最多保留两位小数");
        }
    }

    private List<String> normalizeProducts(List<String> values) {
        return productCatalog.normalizeAll(values);
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
            BigDecimal securityBudget,
            String solution,
            String subSolution,
            List<String> purchasedProducts,
            String track,
            String industry,
            String subIndustry,
            String scenario,
            String keyRisks,
            String keyNeeds,
            Map<String, Object> customFields,
            List<com.presales.pipeline.solution.SolutionSelection> solutions
    ) {
    }
}
