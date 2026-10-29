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
    private final ProductCatalog productCatalog;
    private final com.presales.pipeline.solution.ProjectSolutions solutions;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper;

    public ImportValidator(ConfigService config, DictionaryService dictionaries, RevenueService revenues,
                           Validator validator, CustomFieldDefinitionRepository fieldRepository,ProductCatalog productCatalog,com.presales.pipeline.solution.ProjectSolutions solutions,com.fasterxml.jackson.databind.ObjectMapper mapper) {
        this.solutions=solutions;this.mapper=mapper;
        this.productCatalog=productCatalog;
        this.config = config; this.dictionaries = dictionaries; this.revenues = revenues;
        this.validator = validator; this.fieldRepository = fieldRepository;
    }

    public List<ImportIssue> validate(Map<String, Object> fields, ImportRecordRequest record,
                                      List<ImportFieldDefinition> pending) {
        List<ImportIssue> issues = new ArrayList<>();
        if(fields.containsKey("fixedTarget"))try{fields.put("fixedTarget",parseFixedTarget(fields.get("fixedTarget")));}catch(RuntimeException error){add(issues,"fixedTarget","format",error.getMessage());}
        if(fields.containsKey("projectLevel")){String level=text(fields.get("projectLevel"));if(!level.isEmpty()&&!List.of("无风险","低风险","高风险").contains(level))add(issues,"projectLevel","option","项目级别只能为无风险、低风险、高风险");else fields.put("projectLevel",level);}
        List<com.presales.pipeline.solution.SolutionSelection> selections=null;
        if(fields.containsKey("solutions"))try{
            var raw=fields.get("solutions");if(!(raw instanceof List<?>))throw BusinessException.badRequest("方案集合必须是数组");
            selections=solutions.normalize(mapper.convertValue(raw,new com.fasterxml.jackson.core.type.TypeReference<List<com.presales.pipeline.solution.SolutionSelection>>(){}),null,null);
            fields.put("solutions",selections);fields.put("solution",selections.isEmpty()?null:selections.get(0).solution());fields.put("subSolution",selections.isEmpty()||selections.get(0).subSolutions().isEmpty()?null:selections.get(0).subSolutions().get(0));
        }catch(RuntimeException error){add(issues,"solutions","option",error.getMessage());}
        if(!text(fields.get("nextActionDate")).isEmpty())try{java.time.LocalDate.parse(text(fields.get("nextActionDate")));}catch(RuntimeException error){add(issues,"nextActionDate","format","下次行动日期无效");}
        if(text(fields.get("nextActionNote")).length()>20000)add(issues,"nextActionNote","length","下次行动内容超过20000字符");
        for (String key : List.of("customerName", "projectName")) {
            if (text(fields.get(key)).isEmpty()) add(issues, key, "required", key.equals("customerName") ? "客户名称不能为空" : "项目名称不能为空");
        }
        for (String key : List.of("externalId", "customerName", "projectName", "solution", "subSolution", "track", "industry", "subIndustry", "scenario", "keyRisks", "keyNeeds")) {
            int max = key.equals("externalId") ? 128 : Set.of("scenario", "keyRisks", "keyNeeds").contains(key) ? 20000 : 255;
            if (text(fields.get(key)).length() > max) add(issues, key, "length", "字段超过允许长度 " + max);
        }
        String status = text(fields.get("projectStatus"));
        String track=text(fields.get("track"));if(!track.isEmpty()&&!List.of("HCS","公有云").contains(track))add(issues,"track","option","赛道固定为 HCS、公有云；安全方向须单独映射");
        try{dictionaries.validateSecurityDirection(text(fields.get("securityDirection")));}catch(BusinessException error){add(issues,"securityDirection","option",error.getMessage());}
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
            try { productCatalog.normalize(value); }
            catch (BusinessException exception) { add(issues, "purchasedProducts", "option", exception.getMessage()); }
        }
        dictionaries.selectionErrors(text(fields.get("solution")), text(fields.get("subSolution")), products,
                text(fields.get("track")), text(fields.get("industry")), text(fields.get("subIndustry")))
                .forEach((field, message) -> {if(issues.stream().noneMatch(issue->issue.field().equals(field)))add(issues, field, "option", message);});
        if (ProjectService.WON_STATUS.equals(status)) {
            if (text(fields.get("solution")).isEmpty()) add(issues, "solution", "required", "中标时必须确认解决方案");
            if (selections==null?text(fields.get("subSolution")).isEmpty():selections.stream().noneMatch(s->!s.subSolutions().isEmpty())) add(issues, "subSolution", "required", "中标时必须确认细分解决方案");
            if (products.isEmpty()) add(issues, "purchasedProducts", "required", "中标时至少选择一个已购产品");
        }
        validateCustom(fields.get("customFields"), pending, issues,text(fields.get("track")));
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

    private void validateCustom(Object raw, List<ImportFieldDefinition> pending, List<ImportIssue> issues,String track) {
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
            if(def.applicableTracks()!=null&&!def.applicableTracks().isEmpty()&&!def.applicableTracks().contains(track))continue;
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
    public static boolean parseFixedTarget(Object value){
        if(value instanceof Boolean flag)return flag;
        String text=value==null?"":String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        return switch(text){case "是","true","1","yes","y"->true;case "","否","false","0","no","n"->false;default->throw BusinessException.badRequest("是否固定靶须为是/否、true/false或1/0，不能按非空判断");};
    }

    public static List<String> products(Object raw) {
        if (raw instanceof List<?> list) return list.stream().map(ImportValidator::text).filter(s -> !s.isEmpty()).toList();
        return Arrays.stream(text(raw).split("[,，、]")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
    private static void add(List<ImportIssue> issues, String field, String code, String message) { issues.add(new ImportIssue(field, code, message)); }
}
