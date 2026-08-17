package com.presales.pipeline.importing;

import com.presales.pipeline.audit.ChangeLogService;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.importing.dto.ImportProgressRequest;
import com.presales.pipeline.importing.dto.ImportRecordRequest;
import com.presales.pipeline.importing.dto.ImportRevenueRequest;
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
import java.util.Map;

@Service
public class ImportRecordProcessor {

    private final ProjectRepository projectRepository;
    private final ProjectService projectService;
    private final RevenueService revenueService;
    private final ProgressService progressService;

    public ImportRecordProcessor(ProjectRepository projectRepository,
                                 ProjectService projectService,
                                 RevenueService revenueService,
                                 ProgressService progressService) {
        this.projectRepository = projectRepository;
        this.projectService = projectService;
        this.revenueService = revenueService;
        this.progressService = progressService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProcessedRecord process(ImportRecordRequest record, boolean dryRun) {
        FieldBag fields = new FieldBag(record.fields());
        String externalId = fields.string("externalId", "external_id");
        String incomingCustomer = fields.string("customerName", "customer_name");
        String incomingProject = fields.string("projectName", "project_name");

        Project existing = findExisting(externalId, incomingCustomer, incomingProject);
        if (existing == null && externalId != null) {
            Project deletedMatch = projectRepository.findByExternalId(externalId).orElse(null);
            if (deletedMatch != null && deletedMatch.isDeleted()) {
                throw BusinessException.conflict("外部编号对应的项目在回收站中，请先恢复后再导入");
            }
        }

        ProjectRequest projectRequest = buildProjectRequest(fields, existing);
        projectService.validate(projectRequest, existing == null ? null : existing.getId());
        for (ImportRevenueRequest revenue : record.revenues()) {
            revenueService.validateCell(revenue.month(), revenue.amount());
        }

        if (dryRun) {
            return new ProcessedRecord(existing == null ? Action.ADDED : Action.OVERWRITTEN,
                    existing == null ? null : existing.getId(), projectRequest.externalId(),
                    projectRequest.customerName(), projectRequest.projectName());
        }

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
                project.getCustomerName(), project.getProjectName());
    }

    private Project findExisting(String externalId, String customerName, String projectName) {
        if (externalId != null) {
            Project byExternalId = projectRepository.findFirstByExternalIdAndDeletedFalse(externalId).orElse(null);
            if (byExternalId != null) {
                return byExternalId;
            }
        }
        if (customerName != null && projectName != null) {
            return projectRepository.findFirstByCustomerNameIgnoreCaseAndProjectNameIgnoreCaseAndDeletedFalse(
                    customerName, projectName).orElse(null);
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
                value(fields, existing, "safetySpace", "safety_space", existing == null ? null : existing.getSafetySpace()),
                value(fields, existing, "solution", "solution", existing == null ? null : existing.getSolution()),
                value(fields, existing, "track", "track", existing == null ? null : existing.getTrack()),
                value(fields, existing, "industry", "industry", existing == null ? null : existing.getIndustry()),
                value(fields, existing, "subIndustry", "sub_industry", existing == null ? null : existing.getSubIndustry()),
                value(fields, existing, "scenario", "scenario", existing == null ? null : existing.getScenario()),
                value(fields, existing, "keyRisks", "key_risks", existing == null ? null : existing.getKeyRisks()),
                value(fields, existing, "keyNeeds", "key_needs", existing == null ? null : existing.getKeyNeeds()),
                customFields
        );
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
            String projectName
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

        private String string(String camelKey, String snakeKey) {
            Object value = raw(camelKey, snakeKey);
            if (value == null || String.valueOf(value).isBlank()) {
                return null;
            }
            return String.valueOf(value).trim();
        }
    }
}
