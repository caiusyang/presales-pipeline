package com.presales.pipeline.backup;

import com.presales.pipeline.audit.ChangeLog;
import com.presales.pipeline.audit.ChangeLogRepository;
import com.presales.pipeline.backup.dto.BackupResponse;
import com.presales.pipeline.common.model.BaseEntity;
import com.presales.pipeline.common.model.SoftDeletableEntity;
import com.presales.pipeline.config.CustomFieldDefinition;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import com.presales.pipeline.config.ExportTemplate;
import com.presales.pipeline.config.ExportTemplateRepository;
import com.presales.pipeline.config.ImportMapping;
import com.presales.pipeline.config.ImportMappingRepository;
import com.presales.pipeline.dictionary.DictionaryItem;
import com.presales.pipeline.dictionary.DictionaryRepository;
import com.presales.pipeline.progress.ProgressLog;
import com.presales.pipeline.progress.ProgressLogRepository;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.revenue.Revenue;
import com.presales.pipeline.revenue.RevenueRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class BackupService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");

    private final ProjectRepository projectRepository;
    private final RevenueRepository revenueRepository;
    private final ProgressLogRepository progressRepository;
    private final DictionaryRepository dictionaryRepository;
    private final ImportMappingRepository importMappingRepository;
    private final ExportTemplateRepository exportTemplateRepository;
    private final CustomFieldDefinitionRepository customFieldRepository;
    private final ChangeLogRepository changeLogRepository;

    public BackupService(ProjectRepository projectRepository,
                         RevenueRepository revenueRepository,
                         ProgressLogRepository progressRepository,
                         DictionaryRepository dictionaryRepository,
                         ImportMappingRepository importMappingRepository,
                         ExportTemplateRepository exportTemplateRepository,
                         CustomFieldDefinitionRepository customFieldRepository,
                         ChangeLogRepository changeLogRepository) {
        this.projectRepository = projectRepository;
        this.revenueRepository = revenueRepository;
        this.progressRepository = progressRepository;
        this.dictionaryRepository = dictionaryRepository;
        this.importMappingRepository = importMappingRepository;
        this.exportTemplateRepository = exportTemplateRepository;
        this.customFieldRepository = customFieldRepository;
        this.changeLogRepository = changeLogRepository;
    }

    @Transactional(readOnly = true)
    public BackupResponse exportAll() {
        Map<String, List<Map<String, Object>>> tables = new LinkedHashMap<>();
        tables.put("projects", projectRepository.findAll(Sort.by("id")).stream().map(this::projectRow).toList());
        tables.put("revenues", revenueRepository.findAll(Sort.by("id")).stream().map(this::revenueRow).toList());
        tables.put("progress_logs", progressRepository.findAll(Sort.by("id")).stream().map(this::progressRow).toList());
        tables.put("dictionaries", dictionaryRepository.findAll(Sort.by("id")).stream().map(this::dictionaryRow).toList());
        tables.put("import_mappings", importMappingRepository.findAll(Sort.by("id")).stream().map(this::mappingRow).toList());
        tables.put("export_templates", exportTemplateRepository.findAll(Sort.by("id")).stream().map(this::templateRow).toList());
        tables.put("custom_field_definitions", customFieldRepository.findAll(Sort.by("id")).stream()
                .map(this::customFieldRow).toList());
        tables.put("change_logs", changeLogRepository.findAll(Sort.by("id")).stream().map(this::changeLogRow).toList());
        return new BackupResponse(1, LocalDateTime.now(BUSINESS_ZONE), "Asia/Shanghai", "万元", tables);
    }

    private Map<String, Object> projectRow(Project project) {
        Map<String, Object> row = softBase(project);
        row.put("externalId", project.getExternalId());
        row.put("customerName", project.getCustomerName());
        row.put("projectName", project.getProjectName());
        row.put("projectStatus", project.getProjectStatus());
        row.put("safetySpace", project.getSafetySpace());
        row.put("solution", project.getSolution());
        row.put("subSolution", project.getSubSolution());
        row.put("purchasedProducts", project.getPurchasedProducts());
        row.put("track", project.getTrack());
        row.put("industry", project.getIndustry());
        row.put("subIndustry", project.getSubIndustry());
        row.put("scenario", project.getScenario());
        row.put("keyRisks", project.getKeyRisks());
        row.put("keyNeeds", project.getKeyNeeds());
        row.put("customFields", project.getCustomFields());
        return row;
    }

    private Map<String, Object> revenueRow(Revenue revenue) {
        Map<String, Object> row = softBase(revenue);
        row.put("projectId", revenue.getProject().getId());
        row.put("month", revenue.getMonth());
        row.put("amount", revenue.getAmount());
        return row;
    }

    private Map<String, Object> progressRow(ProgressLog log) {
        Map<String, Object> row = softBase(log);
        row.put("projectId", log.getProject().getId());
        row.put("logDate", log.getLogDate());
        row.put("content", log.getContent());
        return row;
    }

    private Map<String, Object> dictionaryRow(DictionaryItem item) {
        Map<String, Object> row = softBase(item);
        row.put("type", item.getType());
        row.put("value", item.getValue());
        row.put("parentId", item.getParent() == null ? null : item.getParent().getId());
        row.put("sortOrder", item.getSortOrder());
        return row;
    }

    private Map<String, Object> mappingRow(ImportMapping mapping) {
        Map<String, Object> row = softBase(mapping);
        row.put("name", mapping.getName());
        row.put("columnMap", mapping.getColumnMap());
        row.put("valueRules", mapping.getValueRules());
        return row;
    }

    private Map<String, Object> templateRow(ExportTemplate template) {
        Map<String, Object> row = softBase(template);
        row.put("name", template.getName());
        row.put("scope", template.getScope());
        row.put("columns", template.getColumns());
        return row;
    }

    private Map<String, Object> customFieldRow(CustomFieldDefinition definition) {
        Map<String, Object> row = softBase(definition);
        row.put("fieldKey", definition.getFieldKey());
        row.put("label", definition.getLabel());
        row.put("fieldType", definition.getFieldType());
        row.put("required", definition.isRequired());
        row.put("options", definition.getOptions());
        row.put("sortOrder", definition.getSortOrder());
        return row;
    }

    private Map<String, Object> changeLogRow(ChangeLog log) {
        Map<String, Object> row = base(log);
        row.put("projectId", log.getProject().getId());
        row.put("operator", log.getOperator());
        row.put("field", log.getField());
        row.put("oldValue", log.getOldValue());
        row.put("newValue", log.getNewValue());
        row.put("source", log.getSource());
        return row;
    }

    private Map<String, Object> softBase(SoftDeletableEntity entity) {
        Map<String, Object> row = base(entity);
        row.put("deleted", entity.isDeleted());
        return row;
    }

    private Map<String, Object> base(BaseEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", entity.getId());
        row.put("createdAt", entity.getCreatedAt());
        row.put("updatedAt", entity.getUpdatedAt());
        return row;
    }
}
