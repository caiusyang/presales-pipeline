package com.presales.pipeline.followup;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import com.presales.pipeline.dictionary.DictionaryOptions;
import com.presales.pipeline.dictionary.DictionaryRepository;
import com.presales.pipeline.project.Project;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Root;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

/** Whitelisted single-value fields; never coerce multivalue or financial fields into categories. */
@Service @Order(-40)
public class FollowUpFields implements ApplicationRunner {
    public record Choice(String value,String label) {}
    public record Field(String key,String label,String type,List<Choice> options,List<String> applicableTracks) {}
    private final CustomFieldDefinitionRepository custom;
    private final DictionaryRepository dictionaries;
    private final DictionaryOptions dictionaryOptions;
    private final JdbcTemplate jdbc;
    private boolean h2;

    public FollowUpFields(CustomFieldDefinitionRepository custom,DictionaryRepository dictionaries,DictionaryOptions dictionaryOptions,JdbcTemplate jdbc) {
        this.custom=custom;this.dictionaries=dictionaries;this.dictionaryOptions=dictionaryOptions;this.jdbc=jdbc;
    }
    @Override public void run(ApplicationArguments args) {
        h2=Boolean.TRUE.equals(jdbc.execute((ConnectionCallback<Boolean>) connection -> connection.getMetaData().getDatabaseProductName().equals("H2")));
        // H2's test dialect lacks MySQL JSON extraction; this alias is never installed in MySQL.
        if(h2)jdbc.execute("CREATE ALIAS IF NOT EXISTS FOLLOW_UP_JSON_TEXT FOR 'com.presales.pipeline.followup.FollowUpFields.jsonText'");
    }
    public static String jsonText(String json,String key) throws java.io.IOException {
        if(json==null)return null;
        var mapper=new ObjectMapper();var node=mapper.readTree(json);
        if(node.isTextual())node=mapper.readTree(node.asText());
        var value=node.get(key);return value!=null&&value.isTextual()?value.asText():null;
    }
    private static List<Choice> choices(List<String> values) { return values.stream().distinct().map(v->new Choice(v,v)).toList(); }
    public List<Field> list() {
        var fields=new ArrayList<Field>();
        fields.add(new Field("fixedTarget","是否固定靶","option",List.of(new Choice("true","是"),new Choice("false","否")),List.of()));
        fields.add(new Field("projectLevel","项目级别","option",choices(List.of("无风险","低风险","高风险")),List.of()));
        fields.add(new Field("projectStatus","本地售前状态","option",choices(List.of("机会点识别","方案引导","方案设计","中标")),List.of()));
        fields.add(new Field("track","赛道","option",choices(List.of("HCS","公有云")),List.of()));
        for(var pair:List.of(new String[]{"industry","行业","industry"},new String[]{"subIndustry","子行业","sub_industry"},new String[]{"securityDirection","安全方向","security_direction"})) {
            var values=dictionaries.findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(pair[2]).stream().map(d->d.getValue()).toList();
            fields.add(new Field(pair[0],pair[1],"option",choices(values),List.of()));
        }
        fields.add(new Field("hcsStatus","HCS状态","text",List.of(),List.of()));
        for(var def:custom.findAllByDeletedFalseOrderBySortOrderAscIdAsc())if(List.of("text","option").contains(def.getFieldType())) {
            var options=def.getDictionaryType()==null?def.getOptions():dictionaryOptions.resolve(def.getDictionaryType());
            fields.add(new Field("custom."+def.getFieldKey(),def.getLabel()+"（自定义）",def.getFieldType(),choices(options),def.getApplicableTracks()));
        }
        return fields;
    }
    public Field require(String key) { return list().stream().filter(f->f.key().equals(key)).findFirst().orElseThrow(()->BusinessException.badRequest("关联字段不存在，或不是支持的分类/文本字段")); }
    public Field describe(String key) {
        var labels=Map.of("fixedTarget","是否固定靶","projectLevel","项目级别","projectStatus","本地售前状态","track","赛道","industry","行业","subIndustry","子行业","securityDirection","安全方向","hcsStatus","HCS状态");
        if(key!=null&&labels.containsKey(key))return new Field(key,labels.get(key),key.equals("hcsStatus")?"text":"option",List.of(),List.of());
        if(key==null||!key.matches("custom\\.[a-z][a-z0-9_]{0,63}"))throw BusinessException.badRequest("关联字段无效");
        var def=custom.findByFieldKeyAndDeletedFalse(key.substring(7)).filter(d->List.of("text","option").contains(d.getFieldType())).orElseThrow(()->BusinessException.badRequest("关联自定义字段已删除或类型不再受支持，请调整跟进配置"));
        return new Field(key,def.getLabel()+"（自定义）",def.getFieldType(),List.of(),def.getApplicableTracks());
    }

    public Expression<String> expression(Root<Project> root,CriteriaBuilder cb,FollowUpPolicyService.Policy policy) {
        String key=policy.fieldKey();
        if(key.equals("fixedTarget"))return cb.<String>selectCase().when(cb.isTrue(root.get(key)),"true").otherwise("false");
        if(!key.startsWith("custom."))return root.get(key);
        String name=key.substring(7);
        Expression<String> value;
        if(h2)value=cb.function("FOLLOW_UP_JSON_TEXT",String.class,root.get("customFields"),cb.literal(name));
        else {
            var json=cb.function("json_extract",String.class,root.get("customFields"),cb.literal("$.\""+name+"\""));
            value=cb.<String>selectCase().when(cb.equal(cb.function("json_type",String.class,json),"STRING"),cb.function("json_unquote",String.class,json)).otherwise(cb.nullLiteral(String.class));
        }
        if(policy.applicableTracks()!=null&&!policy.applicableTracks().isEmpty())value=cb.<String>selectCase().when(root.get("track").in(policy.applicableTracks()),value).otherwise(cb.nullLiteral(String.class));
        return value;
    }
    public jakarta.persistence.criteria.Predicate matches(CriteriaBuilder cb,Expression<String> normalized,String rule) {
        String lower=rule.toLowerCase(Locale.ROOT);
        // MySQL's usual collation also ignores accents. HEX keeps comparisons aligned with JS exact equality.
        return h2?cb.equal(normalized,lower):cb.equal(cb.function("hex",String.class,normalized),HexFormat.of().withUpperCase().formatHex(lower.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }
}
