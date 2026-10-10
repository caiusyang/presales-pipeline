package com.presales.pipeline.importing;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.config.ConfigService;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import com.presales.pipeline.config.dto.CustomFieldRequest;
import com.presales.pipeline.config.dto.CustomFieldResponse;
import com.presales.pipeline.dictionary.DictionaryService;
import com.presales.pipeline.importing.dto.*;
import com.presales.pipeline.product.ProductCatalog;
import com.presales.pipeline.project.ProjectService;
import com.presales.pipeline.revenue.RevenueService;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/** 预检和正式导入共用；仅校验，不产生字段或项目。 */
@Service
public class ImportValidator {
    private final ConfigService config;
    private final DictionaryService dictionaries;
    private final RevenueService revenues;
    private final Validator validator;
    private final CustomFieldDefinitionRepository fieldRepository;

    public ImportValidator(ConfigService config, DictionaryService dictionaries, RevenueService revenues,
                           Validator validator, CustomFieldDefinitionRepository fieldRepository) {
        this.config = config; this.dictionaries = dictionaries; this.revenues = revenues;
        this.validator = validator; this.fieldRepository = fieldRepository;
    }

    public List<ImportIssue> validate(Map<String, Object> fields, ImportRecordRequest record,
                                      List<ImportFieldDefinition> pending) {
        List<ImportIssue> issues = new ArrayList<>();
        for (String key : List.of("customerName", "projectName")) {
            if (text(fields.get(key)).isEmpty()) add(issues, key, "required", key.equals("customerName") ? "客户名称不能为空" : "项目名称不能为空");
        }
        for (String key : List.of("externalId", "customerName", "projectName", "solution", "subSolution", "track", "industry", "subIndustry", "scenario", "keyRisks", "keyNeeds")) {
            int max = key.equals("externalId") ? 128 : Set.of("scenario", "keyRisks", "keyNeeds").contains(key) ? 20000 : 255;
            if (text(fields.get(key)).length() > max) add(issues, key, "length", "字段超过允许长度 " + max);
        }
        String status = text(fields.get("projectStatus"));
        if (status.isEmpty()) fields.put("projectStatus", ProjectService.DEFAULT_STATUS);
        else if (!ProjectService.PROJECT_STATUSES.contains(status)) add(issues, "projectStatus", "option", "请选择标准项目状态");

        String budget = text(fields.get("securityBudget"));
        if (!budget.isEmpty()) {
            try {
                BigDecimal value = new BigDecimal(budget.replace(",", ""));
                if (value.signum() < 0 || value.scale() > 2 || value.setScale(2).precision() > 18) throw new ArithmeticException();
            } catch (RuntimeException exception) { add(issues, "securityBudget", "format", "客户安全预算须为非负数字，最多16位整数、2位小数"); }
        }
        List<String> products = products(fields.get("purchasedProducts"));
        for (String value : products) {
            try { ProductCatalog.normalize(value); }
            catch (BusinessException exception) { add(issues, "purchasedProducts", "option", exception.getMessage()); }
        }
        dictionaries.selectionErrors(text(fields.get("solution")), text(fields.get("subSolution")), products,
                text(fields.get("track")), text(fields.get("industry")), text(fields.get("subIndustry")))
                .forEach((field, message) -> add(issues, field, "option", message));
        if (ProjectService.WON_STATUS.equals(status)) {
            if (text(fields.get("solution")).isEmpty()) add(issues, "solution", "required", "中标时必须确认解决方案");
            if (text(fields.get("subSolution")).isEmpty()) add(issues, "subSolution", "required", "中标时必须确认细分解决方案");
            if (products.isEmpty()) add(issues, "purchasedProducts", "required", "中标时至少选择一个已购产品");
        }
        validateCustom(fields.get("customFields"), pending, issues);
        for (int i = 0; i < record.revenues().size(); i++) {
            var cell = record.revenues().get(i);
            try {
                if (cell == null) throw BusinessException.badRequest("收入记录不能为空");
                revenues.validateCell(cell.month(), cell.amount());
            } catch (BusinessException exception) { add(issues, "revenues." + i, "format", exception.getMessage()); }
        }
        for (int i = 0; i < record.progress().size(); i++) {
            var entry = record.progress().get(i);
            String key = "progress." + i;
            if (entry == null) add(issues, key, "format", "进展记录不能为空");
            else validator.validate(entry).forEach(error -> add(issues, key, "format", "进展" + error.getPropertyPath() + "：" + error.getMessage()));
        }
        return issues;
    }

    private void validateCustom(Object raw, List<ImportFieldDefinition> pending, List<ImportIssue> issues) {
        if (!(raw instanceof Map<?, ?> values)) { add(issues, "customFields", "format", "自定义字段必须是对象"); return; }
        Map<String, CustomFieldResponse> defs = new LinkedHashMap<>();
        config.listCustomFields().forEach(def -> defs.put(def.fieldKey(), def));
        Set<String> pendingKeys = new HashSet<>();
        for (ImportFieldDefinition field : pending) {
            if (!values.containsKey(field.fieldKey())) continue;
            String key = "custom." + field.fieldKey();
            validator.validate(field).forEach(error -> add(issues, key, "definition", "待新增字段：" + error.getMessage()));
            if (!pendingKeys.add(field.fieldKey())) add(issues, key, "definition", "待新增字段标识重复");
            if (defs.containsKey(field.fieldKey())) {
                if (!defs.get(field.fieldKey()).fieldType().equals(field.fieldType())) add(issues, key, "definition", "字段已存在且类型不同，请重新选择目标字段");
            } else if (fieldRepository.existsByFieldKey(field.fieldKey())) {
                add(issues, key, "definition", "字段已删除，请先恢复原字段");
            } else {
                defs.put(field.fieldKey(), new CustomFieldResponse(null, field.fieldKey(), field.label(), field.fieldType(), false, List.of(), 0, null, null));
            }
        }
        for (Object key : values.keySet()) if (!defs.containsKey(String.valueOf(key))) add(issues, "custom." + key, "definition", "自定义字段尚未定义");
        for (CustomFieldResponse def : defs.values()) {
            String value = text(values.get(def.fieldKey()));
            String key = "custom." + def.fieldKey();
            if (value.isEmpty()) {
                if (def.required()) add(issues, key, "required", def.label() + "为必填项");
                continue;
            }
            try {
                switch (def.fieldType()) {
                    case "number" -> new BigDecimal(value);
                    case "date" -> LocalDate.parse(value);
                    case "option" -> { if (!def.options().contains(value)) add(issues, key, "option", "请选择“" + def.label() + "”的标准选项"); }
                    default -> { }
                }
            } catch (RuntimeException exception) { add(issues, key, "format", "“" + def.label() + "”格式不正确"); }
        }
    }

    public void createUsedFields(Map<String, Object> fields, List<ImportFieldDefinition> pending) {
        Map<?, ?> values = (Map<?, ?>) fields.get("customFields");
        var existing = config.listCustomFields();
        Set<String> keys = new HashSet<>();
        existing.forEach(def -> keys.add(def.fieldKey()));
        int order = existing.stream().mapToInt(CustomFieldResponse::sortOrder).max().orElse(0);
        for (var field : pending) if (values.containsKey(field.fieldKey()) && keys.add(field.fieldKey())) {
            config.createCustomField(new CustomFieldRequest(field.fieldKey(), field.label(), field.fieldType(), false, List.of(), order += 10));
        }
    }

    public Set<String> existingKeys() {
        Set<String> keys = new HashSet<>(); config.listCustomFields().forEach(def -> keys.add(def.fieldKey())); return keys;
    }

    public static List<String> products(Object raw) {
        if (raw instanceof List<?> list) return list.stream().map(ImportValidator::text).filter(s -> !s.isEmpty()).toList();
        return Arrays.stream(text(raw).split("[,，、]")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static void add(List<ImportIssue> issues, String field, String code, String message) { issues.add(new ImportIssue(field, code, message)); }
}
