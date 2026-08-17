package com.presales.pipeline.config;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.config.dto.CustomFieldRequest;
import com.presales.pipeline.config.dto.CustomFieldResponse;
import com.presales.pipeline.config.dto.ExportColumnRequest;
import com.presales.pipeline.config.dto.ExportTemplateRequest;
import com.presales.pipeline.config.dto.ExportTemplateResponse;
import com.presales.pipeline.config.dto.ImportMappingRequest;
import com.presales.pipeline.config.dto.ImportMappingResponse;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ConfigService {

    private static final Set<String> FIELD_TYPES = Set.of("text", "number", "date", "option");

    private final ImportMappingRepository importMappingRepository;
    private final ExportTemplateRepository exportTemplateRepository;
    private final CustomFieldDefinitionRepository customFieldRepository;
    private final ProjectRepository projectRepository;

    public ConfigService(ImportMappingRepository importMappingRepository,
                         ExportTemplateRepository exportTemplateRepository,
                         CustomFieldDefinitionRepository customFieldRepository,
                         ProjectRepository projectRepository) {
        this.importMappingRepository = importMappingRepository;
        this.exportTemplateRepository = exportTemplateRepository;
        this.customFieldRepository = customFieldRepository;
        this.projectRepository = projectRepository;
    }

    @Transactional(readOnly = true)
    public List<ImportMappingResponse> listImportMappings() {
        return importMappingRepository.findAllByDeletedFalseOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ImportMappingResponse getImportMapping(Long id) {
        return toResponse(getImportMappingEntity(id));
    }

    @Transactional(readOnly = true)
    public ImportMapping getImportMappingEntity(Long id) {
        return importMappingRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> BusinessException.notFound("导入映射方案不存在"));
    }

    @Transactional
    public ImportMappingResponse createImportMapping(ImportMappingRequest request) {
        String name = clean(request.name());
        if (importMappingRepository.existsByNameIgnoreCaseAndDeletedFalse(name)) {
            throw BusinessException.conflict("导入映射方案名称已存在");
        }
        ImportMapping mapping = new ImportMapping();
        apply(mapping, request);
        return toResponse(importMappingRepository.save(mapping));
    }

    @Transactional
    public ImportMappingResponse updateImportMapping(Long id, ImportMappingRequest request) {
        ImportMapping mapping = getImportMappingEntity(id);
        String name = clean(request.name());
        if (importMappingRepository.existsByNameIgnoreCaseAndDeletedFalseAndIdNot(name, id)) {
            throw BusinessException.conflict("导入映射方案名称已存在");
        }
        apply(mapping, request);
        return toResponse(mapping);
    }

    @Transactional
    public void deleteImportMapping(Long id) {
        ImportMapping mapping = getImportMappingEntity(id);
        mapping.setDeleted(true);
    }

    @Transactional
    public ImportMappingResponse restoreImportMapping(Long id) {
        ImportMapping mapping = importMappingRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("导入映射方案不存在"));
        if (!mapping.isDeleted()) {
            return toResponse(mapping);
        }
        if (importMappingRepository.existsByNameIgnoreCaseAndDeletedFalse(mapping.getName())) {
            throw BusinessException.conflict("已有同名方案，无法恢复");
        }
        mapping.setDeleted(false);
        return toResponse(mapping);
    }

    @Transactional(readOnly = true)
    public List<ExportTemplateResponse> listExportTemplates() {
        return exportTemplateRepository.findAllByDeletedFalseOrderByScopeAscNameAsc().stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ExportTemplateResponse getExportTemplate(Long id) {
        return toResponse(getExportTemplateEntity(id));
    }

    @Transactional(readOnly = true)
    public ExportTemplate getExportTemplateEntity(Long id) {
        return exportTemplateRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> BusinessException.notFound("导出模板不存在"));
    }

    @Transactional
    public ExportTemplateResponse createExportTemplate(ExportTemplateRequest request) {
        String scope = ExportScope.normalize(request.scope());
        String name = clean(request.name());
        if (exportTemplateRepository.existsByNameIgnoreCaseAndScopeAndDeletedFalse(name, scope)) {
            throw BusinessException.conflict("同一导出范围内的模板名称已存在");
        }
        ExportTemplate template = new ExportTemplate();
        apply(template, request, scope);
        return toResponse(exportTemplateRepository.save(template));
    }

    @Transactional
    public ExportTemplateResponse updateExportTemplate(Long id, ExportTemplateRequest request) {
        ExportTemplate template = getExportTemplateEntity(id);
        String scope = ExportScope.normalize(request.scope());
        String name = clean(request.name());
        if (exportTemplateRepository.existsByNameIgnoreCaseAndScopeAndDeletedFalseAndIdNot(name, scope, id)) {
            throw BusinessException.conflict("同一导出范围内的模板名称已存在");
        }
        apply(template, request, scope);
        return toResponse(template);
    }

    @Transactional
    public void deleteExportTemplate(Long id) {
        getExportTemplateEntity(id).setDeleted(true);
    }

    @Transactional
    public ExportTemplateResponse restoreExportTemplate(Long id) {
        ExportTemplate template = exportTemplateRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("导出模板不存在"));
        if (!template.isDeleted()) {
            return toResponse(template);
        }
        if (exportTemplateRepository.existsByNameIgnoreCaseAndScopeAndDeletedFalse(
                template.getName(), template.getScope())) {
            throw BusinessException.conflict("已有同名模板，无法恢复");
        }
        template.setDeleted(false);
        return toResponse(template);
    }

    @Transactional(readOnly = true)
    public List<CustomFieldResponse> listCustomFields() {
        return customFieldRepository.findAllByDeletedFalseOrderBySortOrderAscIdAsc().stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CustomFieldResponse getCustomField(Long id) {
        return toResponse(getCustomFieldEntity(id));
    }

    @Transactional
    public CustomFieldResponse createCustomField(CustomFieldRequest request) {
        if (customFieldRepository.existsByFieldKey(request.fieldKey())) {
            throw BusinessException.conflict("自定义字段标识已存在；若它已删除，请恢复原字段");
        }
        CustomFieldDefinition definition = new CustomFieldDefinition();
        apply(definition, request, true);
        return toResponse(customFieldRepository.save(definition));
    }

    @Transactional
    public CustomFieldResponse updateCustomField(Long id, CustomFieldRequest request) {
        CustomFieldDefinition definition = getCustomFieldEntity(id);
        if (!definition.getFieldKey().equals(request.fieldKey())) {
            throw BusinessException.conflict("字段标识已投入使用，不能修改；可修改显示名称和规则");
        }
        validateExistingValues(request);
        apply(definition, request, false);
        return toResponse(definition);
    }

    @Transactional
    public void deleteCustomField(Long id) {
        CustomFieldDefinition definition = getCustomFieldEntity(id);
        boolean used = projectRepository.findAllByDeletedFalseOrderByIdAsc().stream()
                .map(Project::getCustomFields)
                .anyMatch(fields -> fields.containsKey(definition.getFieldKey()));
        if (used) {
            throw BusinessException.conflict("该自定义字段已有项目数据引用，不能删除");
        }
        definition.setDeleted(true);
    }

    @Transactional
    public CustomFieldResponse restoreCustomField(Long id) {
        CustomFieldDefinition definition = customFieldRepository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("自定义字段不存在"));
        definition.setDeleted(false);
        return toResponse(definition);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> normalizeAndValidateCustomFields(Map<String, Object> incoming) {
        Map<String, Object> values = incoming == null ? Map.of() : incoming;
        List<CustomFieldDefinition> definitions = customFieldRepository.findAllByDeletedFalseOrderBySortOrderAscIdAsc();
        Map<String, CustomFieldDefinition> byKey = definitions.stream()
                .collect(Collectors.toMap(CustomFieldDefinition::getFieldKey, item -> item));

        Set<String> unknown = new LinkedHashSet<>(values.keySet());
        unknown.removeAll(byKey.keySet());
        if (!unknown.isEmpty()) {
            throw BusinessException.badRequest("存在未定义的自定义字段：" + String.join(", ", unknown));
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        for (CustomFieldDefinition definition : definitions) {
            Object raw = values.get(definition.getFieldKey());
            if (isEmpty(raw)) {
                if (definition.isRequired()) {
                    throw BusinessException.badRequest("自定义字段“" + definition.getLabel() + "”为必填项");
                }
                continue;
            }
            normalized.put(definition.getFieldKey(), normalizeValue(definition, raw));
        }
        return normalized;
    }

    private void apply(ImportMapping mapping, ImportMappingRequest request) {
        mapping.setName(clean(request.name()));
        mapping.setColumnMap(request.columnMap());
        mapping.setValueRules(request.valueRules());
    }

    private void apply(ExportTemplate template, ExportTemplateRequest request, String scope) {
        Set<String> allowedKeys = allowedExportKeys(scope);
        Set<String> keys = new LinkedHashSet<>();
        List<Map<String, Object>> columns = new ArrayList<>();
        for (ExportColumnRequest column : request.columns()) {
            String key = clean(column.key());
            if (!allowedKeys.contains(key)) {
                throw BusinessException.badRequest("当前导出范围不支持字段：" + key);
            }
            if (!keys.add(key)) {
                throw BusinessException.badRequest("导出列不能重复：" + key);
            }
            columns.add(Map.of("key", key, "title", clean(column.title())));
        }
        template.setName(clean(request.name()));
        template.setScope(scope);
        template.setColumns(columns);
    }

    private Set<String> allowedExportKeys(String scope) {
        Set<String> keys = new LinkedHashSet<>();
        switch (scope) {
            case ExportScope.PROJECTS -> {
                keys.addAll(Set.of("id", "externalId", "customerName", "projectName", "safetySpace",
                        "solution", "track", "industry", "subIndustry", "scenario", "keyRisks",
                        "keyNeeds", "revenueTotal", "createdAt", "updatedAt"));
                customFieldRepository.findAllByDeletedFalseOrderBySortOrderAscIdAsc().forEach(definition ->
                        keys.add("custom." + definition.getFieldKey()));
            }
            case ExportScope.REVENUES -> keys.addAll(Set.of("projectId", "externalId", "customerName",
                    "projectName", "industry", "track", "month", "amount"));
            case ExportScope.PROGRESS -> keys.addAll(Set.of("projectId", "externalId", "customerName",
                    "projectName", "industry", "track", "logDate", "content", "createdAt"));
            default -> throw BusinessException.badRequest("未知导出范围");
        }
        return keys;
    }

    private void apply(CustomFieldDefinition definition, CustomFieldRequest request, boolean creating) {
        String type = normalizeFieldType(request.fieldType());
        List<String> options = request.options().stream().map(this::clean).distinct().toList();
        if ("option".equals(type) && options.isEmpty()) {
            throw BusinessException.badRequest("选项型字段至少需要一个选项");
        }
        if (creating) {
            definition.setFieldKey(request.fieldKey());
        }
        definition.setLabel(clean(request.label()));
        definition.setFieldType(type);
        definition.setRequired(request.required());
        definition.setOptions("option".equals(type) ? options : List.of());
        definition.setSortOrder(request.sortOrder());
    }

    private void validateExistingValues(CustomFieldRequest request) {
        CustomFieldDefinition candidate = new CustomFieldDefinition();
        candidate.setFieldKey(request.fieldKey());
        candidate.setLabel(clean(request.label()));
        candidate.setFieldType(normalizeFieldType(request.fieldType()));
        candidate.setRequired(request.required());
        candidate.setOptions(request.options().stream().map(this::clean).distinct().toList());
        for (Project project : projectRepository.findAllByDeletedFalseOrderByIdAsc()) {
            Object value = project.getCustomFields().get(request.fieldKey());
            if (isEmpty(value)) {
                if (request.required()) {
                    throw BusinessException.conflict("仍有项目缺少该字段，不能改为必填");
                }
                continue;
            }
            try {
                normalizeValue(candidate, value);
            } catch (BusinessException exception) {
                throw BusinessException.conflict("现有项目“" + project.getProjectName() + "”的字段值不符合新规则");
            }
        }
    }

    private Object normalizeValue(CustomFieldDefinition definition, Object raw) {
        String text = String.valueOf(raw).trim();
        try {
            return switch (definition.getFieldType()) {
                case "text" -> text;
                case "number" -> new BigDecimal(text);
                case "date" -> LocalDate.parse(text).toString();
                case "option" -> {
                    if (!definition.getOptions().contains(text)) {
                        throw BusinessException.badRequest("字段“" + definition.getLabel() + "”的选项无效");
                    }
                    yield text;
                }
                default -> throw BusinessException.badRequest("未知自定义字段类型");
            };
        } catch (NumberFormatException | DateTimeParseException exception) {
            throw BusinessException.badRequest("字段“" + definition.getLabel() + "”的值格式不正确");
        }
    }

    private String normalizeFieldType(String value) {
        String type = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!FIELD_TYPES.contains(type)) {
            throw BusinessException.badRequest("字段类型仅支持 text、number、date、option");
        }
        return type;
    }

    private boolean isEmpty(Object value) {
        return value == null || (value instanceof String stringValue && stringValue.isBlank());
    }

    private CustomFieldDefinition getCustomFieldEntity(Long id) {
        return customFieldRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> BusinessException.notFound("自定义字段不存在"));
    }

    private String clean(String value) {
        return Objects.requireNonNull(value).trim();
    }

    private ImportMappingResponse toResponse(ImportMapping mapping) {
        return new ImportMappingResponse(mapping.getId(), mapping.getName(), mapping.getColumnMap(),
                mapping.getValueRules(), mapping.getCreatedAt(), mapping.getUpdatedAt());
    }

    @SuppressWarnings("unchecked")
    private ExportTemplateResponse toResponse(ExportTemplate template) {
        List<ExportColumnRequest> columns = template.getColumns().stream()
                .map(column -> new ExportColumnRequest(String.valueOf(column.get("key")), String.valueOf(column.get("title"))))
                .toList();
        return new ExportTemplateResponse(template.getId(), template.getName(), template.getScope(), columns,
                template.getCreatedAt(), template.getUpdatedAt());
    }

    private CustomFieldResponse toResponse(CustomFieldDefinition definition) {
        return new CustomFieldResponse(definition.getId(), definition.getFieldKey(), definition.getLabel(),
                definition.getFieldType(), definition.isRequired(), definition.getOptions(), definition.getSortOrder(),
                definition.getCreatedAt(), definition.getUpdatedAt());
    }
}
