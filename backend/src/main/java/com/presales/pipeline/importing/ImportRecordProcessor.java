package com.presales.pipeline.importing;

import com.presales.pipeline.audit.ChangeLogService;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.importing.dto.ImportProgressRequest;
import com.presales.pipeline.importing.dto.ImportRecordRequest;
import com.presales.pipeline.importing.dto.ImportRevenueRequest;
import com.presales.pipeline.importing.dto.ImportFieldDefinition;
import com.presales.pipeline.importing.dto.ImportIssue;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.presales.pipeline.progress.ProgressService;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.project.ProjectService;
import com.presales.pipeline.project.dto.ProjectRequest;
import com.presales.pipeline.revenue.RevenueService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ImportRecordProcessor {

    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final RevenueService revenueService;
    private final ProgressService progressService;
    private final ImportValidator importValidator;
    private final ObjectMapper mapper;
    private final com.presales.pipeline.project.ProjectIdentityGuard identities;
    private final com.presales.pipeline.tasks.TaskHistoryService history;

    public ImportRecordProcessor(ProjectRepository projectRepository,
                                 ProjectService projectService,
                                 RevenueService revenueService,
                                 ProgressService progressService, ImportValidator importValidator, ObjectMapper mapper,com.presales.pipeline.project.ProjectIdentityGuard identities,com.presales.pipeline.tasks.TaskHistoryService history) {
        this.history=history;
        this.identities=identities;
        this.projectRepository = projectRepository;
        this.projectService = projectService;
        this.revenueService = revenueService;
        this.progressService = progressService;
        this.importValidator = importValidator;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProcessedRecord process(ImportRecordRequest record, boolean dryRun, List<ImportFieldDefinition> pending) {
        return processCore(record, dryRun, pending, java.util.Set.of());
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProcessedRecord process(ImportRecordRequest record, boolean dryRun, List<ImportFieldDefinition> pending,java.util.Set<String> seen) {return processCore(record,dryRun,pending,seen);}

    /** Joins the job-item transaction, so business data and success marker commit atomically. */
    @Transactional
    public ProcessedRecord processJoined(ImportRecordRequest record, boolean dryRun, List<ImportFieldDefinition> pending, java.util.Set<String> seen) {
        return processCore(record, dryRun, pending, seen);
    }

    private ProcessedRecord processCore(ImportRecordRequest record, boolean dryRun, List<ImportFieldDefinition> pending, java.util.Set<String> seen) {
        FieldBag fields = new FieldBag(record.fields());
        String externalId = fields.string("externalId", "external_id");
        String incomingCustomer = fields.string("customerName", "customer_name");
        String incomingProject = fields.string("projectName", "project_name");
        if(incomingCustomer!=null&&incomingProject!=null)identities.acquire(incomingCustomer,incomingProject);

        Project existing = findExisting(externalId, incomingCustomer, incomingProject);
        // A concurrent hard-delete may have committed while the identity/project lock was awaited.
        history.assertCurrentImportAllowed(record);
        if (existing == null && externalId != null) {
            Project deletedMatch = projectRepository.findByExternalId(externalId).orElse(null);
            if (deletedMatch != null && deletedMatch.isDeleted()) {
                throw BusinessException.conflict("外部编号对应的项目在回收站中，请先恢复后再导入");
            }
        }

        Map<String, Object> effective = existing == null ? new LinkedHashMap<>()
                : mapper.convertValue(projectService.toResponse(existing, BigDecimal.ZERO), new TypeReference<>() {});
        Map<String, Object> custom = existing == null ? new LinkedHashMap<>() : new LinkedHashMap<>(existing.getCustomFields());
        record.fields().forEach((key, value) -> {
            String canonical = camelKey(key);
            // 保持 camelCase 优先于 snake_case 的旧契约。
            if (!key.equals(canonical) && record.fields().containsKey(canonical)) return;
            if (canonical.equals("customFields") && value instanceof Map<?, ?> values) {
                values.forEach((k, v) -> { if (v == null || v instanceof String s && s.isBlank()) custom.remove(String.valueOf(k)); else custom.put(String.valueOf(k), v); });
            } else effective.put(canonical, value);
        });
        if(!record.fields().containsKey("solutions")&&(record.fields().containsKey("solution")||record.fields().containsKey("subSolution")||record.fields().containsKey("sub_solution")))effective.remove("solutions");
        if (!(effective.containsKey("customFields") && !(effective.get("customFields") instanceof Map))) effective.put("customFields", custom);
        List<ImportIssue> issues = importValidator.validate(effective, record, pending);
        if (!issues.isEmpty()) throw new ImportValidationException(issues, effective);
        effective.put("purchasedProducts", ImportValidator.products(effective.get("purchasedProducts")));

        // 待新增字段已在上方校验；现有项目校验只接收已定义字段。
        Map<String, Object> known = new LinkedHashMap<>(effective);
        Map<String, Object> knownCustom = new LinkedHashMap<>(custom);
        var knownKeys = importValidator.existingKeys();
        knownCustom.keySet().removeIf(key -> !knownKeys.contains(key));
        known.put("customFields", knownCustom);
        if(dryRun)try {
            projectService.validate(buildProjectRequest(new FieldBag(known), null), existing == null ? null : existing.getId());
        } catch (BusinessException exception) {
            throw new ImportValidationException(List.of(new ImportIssue("_record", "conflict", exception.getMessage())), effective);
        }

        ProjectRequest projectRequest = buildProjectRequest(new FieldBag(effective), null);
        var identities = identities(existing == null ? null : existing.getId(), projectRequest.externalId(), projectRequest.customerName(), projectRequest.projectName());
        if (identities.stream().anyMatch(seen::contains)) throw new ImportValidationException(List.of(new ImportIssue("_record", "duplicate", "同批次项目重复，仅处理首次通过的记录")), effective);

        if (dryRun) {
            return new ProcessedRecord(existing == null ? Action.ADDED : Action.OVERWRITTEN,
                    existing == null ? null : existing.getId(), projectRequest.externalId(),
                    projectRequest.customerName(), projectRequest.projectName(), effective);
        }

        importValidator.createUsedFields(effective, pending);
        Project project;
        Action action;
        if (existing == null) {
            project = projectService.createEntity(projectRequest, ChangeLogService.SOURCE_IMPORT);
            action = Action.ADDED;
        } else {
            projectService.applyUpdate(existing, projectRequest, ChangeLogService.SOURCE_IMPORT);
            project = existing;
            action = Action.OVERWRITTEN;
        }
        for (ImportRevenueRequest revenue : record.revenues()) {
            revenueService.upsert(project, revenue.month(), revenue.amount(), ChangeLogService.SOURCE_IMPORT);
        }
        for (ImportProgressRequest progress : record.progress()) {
            progressService.addIfAbsent(project, progress.logDate(), progress.content(), ChangeLogService.SOURCE_IMPORT);
        }
        return new ProcessedRecord(action, project.getId(), project.getExternalId(),
                project.getCustomerName(), project.getProjectName(), effective);
    }

    public static java.util.Set<String> identities(Long projectId,String externalId,String customer,String name) {
        var keys = new java.util.HashSet<String>();
        if(projectId!=null) keys.add("id:"+projectId);
        if(externalId!=null&&!externalId.isBlank())keys.add("ext:"+externalId.toLowerCase(java.util.Locale.ROOT));
        keys.add("name:"+String.valueOf(customer).toLowerCase(java.util.Locale.ROOT)+"\u0000"+String.valueOf(name).toLowerCase(java.util.Locale.ROOT));return keys;
    }

    private String camelKey(String key) {
        StringBuilder result = new StringBuilder(); boolean upper = false;
        for (char c : key.toCharArray()) { if (c == '_') upper = true; else { result.append(upper ? Character.toUpperCase(c) : c); upper = false; } }
        return result.toString();
    }

    private Project findExisting(String externalId, String customerName, String projectName) {
        var snapshot=ImportBatchLookup.current();
        if(snapshot!=null){
            var candidate=externalId==null?null:snapshot.external().get(externalId.toLowerCase(java.util.Locale.ROOT));
            if(candidate==null)candidate=snapshot.names().get(ImportBatchLookup.pair(customerName,projectName));
            if(candidate!=null&&!candidate.deleted()){
                var fresh=projectRepository.findByIdForUpdate(candidate.id()).orElse(null);
                if(fresh!=null&&!fresh.isDeleted()&&(externalId!=null&&externalId.equalsIgnoreCase(fresh.getExternalId())||fresh.getCustomerName().equalsIgnoreCase(String.valueOf(customerName))&&fresh.getProjectName().equalsIgnoreCase(String.valueOf(projectName))))return fresh;
            }
        }
        if (externalId != null) {
            Project byExternalId = projectRepository.findByExternalIdForUpdate(externalId).filter(p->!p.isDeleted()).orElse(null);
            if (byExternalId != null) {
                return projectService.getActiveEntityForUpdate(byExternalId.getId());
            }
        }
        if (customerName != null && projectName != null) {
            return projectRepository.findActiveByNameForUpdate(customerName,projectName).orElse(null);
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private ProjectRequest buildProjectRequest(FieldBag fields, Project existing) {
        Map<String, Object> customFields = existing == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(existing.getCustomFields());
        if (fields.contains("customFields", "custom_fields")) {
            Object raw = fields.raw("customFields", "custom_fields");
            if (!(raw instanceof Map<?, ?> incoming)) {
                throw BusinessException.badRequest("customFields 必须是 JSON 对象");
            }
            for (Map.Entry<?, ?> entry : incoming.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (entry.getValue() == null || (entry.getValue() instanceof String text && text.isBlank())) {
                    customFields.remove(key);
                } else {
                    customFields.put(key, entry.getValue());
                }
            }
        }

        return new ProjectRequest(
                value(fields, existing, "externalId", "external_id", existing == null ? null : existing.getExternalId()),
                requiredValue(fields, existing, "customerName", "customer_name",
                        existing == null ? null : existing.getCustomerName(), "客户名称"),
                requiredValue(fields, existing, "projectName", "project_name",
                        existing == null ? null : existing.getProjectName(), "项目名称"),
                value(fields, existing, "projectStatus", "project_status",
                        existing == null ? ProjectService.DEFAULT_STATUS : existing.getProjectStatus()),
                budgetValue(fields, existing),
                value(fields, existing, "solution", "solution", existing == null ? null : existing.getSolution()),
                value(fields, existing, "subSolution", "sub_solution", existing == null ? null : existing.getSubSolution()),
                listValue(fields, "purchasedProducts", "purchased_products",
                        existing == null ? List.of() : existing.getPurchasedProducts()),
                value(fields, existing, "track", "track", existing == null ? null : existing.getTrack()),
                value(fields, existing, "industry", "industry", existing == null ? null : existing.getIndustry()),
                value(fields, existing, "subIndustry", "sub_industry", existing == null ? null : existing.getSubIndustry()),
                value(fields, existing, "scenario", "scenario", existing == null ? null : existing.getScenario()),
                value(fields, existing, "keyRisks", "key_risks", existing == null ? null : existing.getKeyRisks()),
                value(fields, existing, "keyNeeds", "key_needs", existing == null ? null : existing.getKeyNeeds()),
                customFields,
                fields.string("nextActionDate","next_action_date")==null?null:java.time.LocalDate.parse(fields.string("nextActionDate","next_action_date")),
                fields.string("nextActionNote","next_action_note"),
                fields.string("securityDirection","security_direction"),
                fields.contains("solutions","solutions")?mapper.convertValue(fields.raw("solutions","solutions"),new TypeReference<List<com.presales.pipeline.solution.SolutionSelection>>(){}):null,
                fields.string("hcsOpportunityId","hcs_opportunity_id"),
                fields.contains("responsibleIds","responsible_ids")?mapper.convertValue(fields.raw("responsibleIds","responsible_ids"),new TypeReference<List<Long>>(){}):null,
                fields.contains("fixedTarget","fixed_target")?ImportValidator.parseFixedTarget(fields.raw("fixedTarget","fixed_target")):null,
                fields.contains("projectLevel","project_level")?java.util.Objects.toString(fields.raw("projectLevel","project_level"),"").trim():null
        );
    }

    private List<String> listValue(FieldBag fields, String camelKey, String snakeKey, List<String> fallback) {
        if (!fields.contains(camelKey, snakeKey)) {
            return fallback;
        }
        Object raw = fields.raw(camelKey, snakeKey);
        if (raw == null) {
            return List.of();
        }
        if (raw instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return java.util.Arrays.stream(String.valueOf(raw).split("[,，]"))
                .map(String::trim).filter(value -> !value.isEmpty()).toList();
    }

    private BigDecimal budgetValue(FieldBag fields, Project existing) {
        BigDecimal fallback = existing == null ? null : existing.getSecurityBudget();
        if (!fields.containsAny("securityBudget", "security_budget")) {
            return fallback;
        }
        Object raw = fields.rawAny("securityBudget", "security_budget");
        if (raw == null || String.valueOf(raw).isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(String.valueOf(raw).trim().replace(",", ""));
        } catch (NumberFormatException exception) {
            throw BusinessException.badRequest("客户安全预算必须是数字");
        }
    }

    private String value(FieldBag fields, Project existing, String camelKey, String snakeKey, String fallback) {
        if (!fields.contains(camelKey, snakeKey)) {
            return fallback;
        }
        return fields.string(camelKey, snakeKey);
    }

    private String requiredValue(FieldBag fields, Project existing, String camelKey, String snakeKey,
                                 String fallback, String label) {
        String value = value(fields, existing, camelKey, snakeKey, fallback);
        if (value == null) {
            throw BusinessException.badRequest(label + "不能为空");
        }
        return value;
    }

    public enum Action {
        ADDED, OVERWRITTEN
    }

    public record ProcessedRecord(
            Action action,
            Long projectId,
            String externalId,
            String customerName,
            String projectName,
            Map<String, Object> effectiveFields
    ) {
    }

    private static final class FieldBag {
        private final Map<String, Object> fields;

        private FieldBag(Map<String, Object> fields) {
            this.fields = fields;
        }

        private boolean contains(String camelKey, String snakeKey) {
            return fields.containsKey(camelKey) || fields.containsKey(snakeKey);
        }

        private Object raw(String camelKey, String snakeKey) {
            return fields.containsKey(camelKey) ? fields.get(camelKey) : fields.get(snakeKey);
        }

        private boolean containsAny(String... keys) {
            return java.util.Arrays.stream(keys).anyMatch(fields::containsKey);
        }

        private Object rawAny(String... keys) {
            return java.util.Arrays.stream(keys).filter(fields::containsKey).findFirst().map(fields::get).orElse(null);
        }

        private String string(String camelKey, String snakeKey) {
            Object value = raw(camelKey, snakeKey);
            if (value == null || String.valueOf(value).isBlank()) {
                return null;
            }
            return String.valueOf(value).trim();
        }
    }
}
