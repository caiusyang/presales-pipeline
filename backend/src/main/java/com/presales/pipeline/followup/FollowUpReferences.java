package com.presales.pipeline.followup;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.config.CustomFieldDefinition;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import com.presales.pipeline.dictionary.DictionaryOptions;
import org.springframework.stereotype.Service;
import java.util.*;

/** Protect rules from silently losing their source field or categorical values. */
@Service
public class FollowUpReferences {
    private final FollowUpPolicyRepository policies;
    private final CustomFieldDefinitionRepository fields;
    private final DictionaryOptions options;
    public FollowUpReferences(FollowUpPolicyRepository policies,CustomFieldDefinitionRepository fields,DictionaryOptions options){this.policies=policies;this.fields=fields;this.options=options;}
    public void assertFieldDeletable(String key) {
        if(policies.findById(1L).filter(p->("custom."+key).equals(p.fieldKey)).isPresent())throw BusinessException.conflict("该字段已关联跟进周期，请先切换跟进提醒的关联字段");
    }
    public void assertFieldUpdate(CustomFieldDefinition field) {
        var policy=policies.findById(1L).filter(p->("custom."+field.getFieldKey()).equals(p.fieldKey));
        if(policy.isEmpty())return;
        if(!List.of("text","option").contains(field.getFieldType()))throw BusinessException.conflict("该字段已关联跟进周期，暂不能更改为数字或日期类型，请先切换关联字段");
        if(field.getFieldType().equals("option")) {
            var values=field.getDictionaryType()==null?field.getOptions():options.resolve(field.getDictionaryType());
            if(policy.get().valueRules.stream().anyMatch(r->values.stream().noneMatch(v->v.equalsIgnoreCase(r.value()))))throw BusinessException.conflict("有跟进规则仍使用被移除的选项，请先调整跟进提醒规则");
        }
    }
    public void assertDictionaryValueMutable(String type,String value) {
        var policy=policies.findById(1L).orElse(null);
        if(policy==null||policy.valueRules==null||policy.valueRules.stream().noneMatch(r->r.value().equalsIgnoreCase(value)))return;
        String base=Map.of("industry","industry","sub_industry","subIndustry","security_direction","securityDirection","track","track").get(type);
        boolean linked=Objects.equals(base,policy.fieldKey)||fields.findAllByDeletedFalseOrderBySortOrderAscIdAsc().stream().anyMatch(f->("custom."+f.getFieldKey()).equals(policy.fieldKey)&&type.equals(f.getDictionaryType()));
        if(linked)throw BusinessException.conflict("该字典值已用于跟进周期，请先调整跟进提醒规则再改名或删除");
    }
}
