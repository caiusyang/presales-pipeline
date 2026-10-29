package com.presales.pipeline.followup;

import com.presales.pipeline.common.config.BusinessTime;
import com.presales.pipeline.importing.ImportReferenceScope;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import java.util.*;
import com.presales.pipeline.common.exception.BusinessException;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Order(-30)
public class FollowUpPolicyService implements ApplicationRunner {
    public record Rule(@NotBlank @Size(max=255) String value,@Min(1) @Max(3650) @JsonDeserialize(using=StrictDays.class) int days) {}
    public record Policy(
            @Min(1) @Max(3650) @JsonDeserialize(using=StrictDays.class) Integer fixedTargetDays,
            @Min(1) @Max(3650) @JsonDeserialize(using=StrictDays.class) Integer normalDays,
            @Size(max=80) String fieldKey,
            @Min(1) @Max(3650) @JsonDeserialize(using=StrictDays.class) Integer defaultDays,
            @Size(max=100) List<@Valid Rule> rules,
            String fieldLabel,List<String> applicableTracks) {
        public Policy(int fixed,int normal){this(fixed,normal,"fixedTarget",normal,List.of(new Rule("true",fixed),new Rule("false",normal)),"是否固定靶",List.of());}
    }

    /** Do not silently truncate e.g. 7.5 to a seven-day interval. */
    public static class StrictDays extends JsonDeserializer<Integer> {
        @Override
        public Integer deserialize(JsonParser parser, DeserializationContext context) throws java.io.IOException {
            if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) {
                throw JsonMappingException.from(parser, "跟进周期必须是整数");
            }
            return parser.getIntValue();
        }
    }

    private final FollowUpPolicyRepository repository;
    private final FollowUpFields fields;

    public FollowUpPolicyService(FollowUpPolicyRepository repository,FollowUpFields fields) {
        this.repository = repository;
        this.fields=fields;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // Flyway seeds production; create-drop test databases still need the default rule.
        if (!repository.existsById(1L)) {
            var row = new FollowUpPolicy();
            row.updatedAt = BusinessTime.now();
            repository.save(row);
        }
    }

    @Transactional(readOnly=true)
    public Policy get() {
        return ImportReferenceScope.cached("follow-up-policy", () -> repository.findById(1L)
                .map(this::response).orElse(new Policy(7, 14)));
    }

    @Transactional(readOnly=true)
    public List<FollowUpFields.Field> fields() { return fields.list(); }
    private Policy response(FollowUpPolicy row) {
        var field=fields.describe(row.fieldKey);
        return new Policy(row.fixedTargetDays,row.normalDays,row.fieldKey,row.defaultDays,row.valueRules==null?List.of():row.valueRules,field.label(),field.applicableTracks());
    }
    public org.springframework.data.jpa.domain.Specification<com.presales.pipeline.project.Project> due(Policy policy) {
        return (root,query,cb)->{
            var value=cb.lower(cb.trim(cb.coalesce(fields.expression(root,cb,policy),"")));
            var last=cb.<java.time.LocalDateTime>coalesce(root.get("lastFollowUpAt"),root.get("createdAt"));
            var today=java.time.LocalDate.now(BusinessTime.ZONE);
            var fallback=today.minusDays(policy.defaultDays()).plusDays(1).atStartOfDay();
            if(policy.rules().isEmpty())return cb.lessThan(last,fallback);
            // One linear CASE expression, not an OR of N copies of all rules.
            var cutoff=cb.<java.time.LocalDateTime>selectCase();
            for(var rule:policy.rules())cutoff.when(fields.matches(cb,value,rule.value()),today.minusDays(rule.days()).plusDays(1).atStartOfDay());
            return cb.lessThan(last,cutoff.otherwise(fallback));
        };
    }

    @Transactional
    public Policy save(Policy input) {
        var row = repository.findById(1L).orElseGet(FollowUpPolicy::new);
        boolean legacy=input.fieldKey()==null&&input.defaultDays()==null&&input.rules()==null;
        if(legacy) {
            if(!row.fieldKey.equals("fixedTarget"))throw BusinessException.conflict("当前已关联其他字段，请刷新配置后再保存，不能由旧客户端重置规则");
            if(input.fixedTargetDays()==null||input.normalDays()==null)throw BusinessException.badRequest("请提供两个跟进周期");
            input=new Policy(input.fixedTargetDays(),input.normalDays());
        }
        var field=fields.require(input.fieldKey());
        if(input.defaultDays()==null||input.defaultDays()<1||input.defaultDays()>3650||input.rules()==null||input.rules().size()>100)throw BusinessException.badRequest("请配置合法的默认周期和至多100条值规则");
        var seen=new HashSet<String>();var rules=new ArrayList<Rule>();
        for(var rule:input.rules()) {
            if(rule==null||rule.value()==null||rule.value().trim().isEmpty()||rule.value().trim().length()>255||rule.days()<1||rule.days()>3650)throw BusinessException.badRequest("规则值不能为空，周期须为1—3650天整数");
            String value=rule.value().trim();
            if(!seen.add(value.toLowerCase(Locale.ROOT)))throw BusinessException.badRequest("同一字段值不能设置多个跟进周期");
            if(field.type().equals("option")&&field.options().stream().noneMatch(option->option.value().equalsIgnoreCase(value)))throw BusinessException.badRequest("规则值不在关联字段的选项中："+value);
            String canonical=field.options().stream().filter(option->option.value().equalsIgnoreCase(value)).map(FollowUpFields.Choice::value).findFirst().orElse(value);
            rules.add(new Rule(canonical,rule.days()));
        }
        row.fieldKey=field.key();row.defaultDays=input.defaultDays();row.valueRules=List.copyOf(rules);
        if(row.fieldKey.equals("fixedTarget")) {
            row.fixedTargetDays=rules.stream().filter(r->r.value().equalsIgnoreCase("true")).map(Rule::days).findFirst().orElse(row.defaultDays);
            row.normalDays=rules.stream().filter(r->r.value().equalsIgnoreCase("false")).map(Rule::days).findFirst().orElse(row.defaultDays);
        }
        row.updatedAt = BusinessTime.now();
        repository.saveAndFlush(row);
        ImportReferenceScope.clear();
        return response(row);
    }
}
