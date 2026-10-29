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
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Order(-30)
public class FollowUpPolicyService implements ApplicationRunner {
    public record Policy(
            @Min(1) @Max(3650) @JsonDeserialize(using=StrictDays.class) int fixedTargetDays,
            @Min(1) @Max(3650) @JsonDeserialize(using=StrictDays.class) int normalDays) {}

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

    public FollowUpPolicyService(FollowUpPolicyRepository repository) {
        this.repository = repository;
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
                .map(row -> new Policy(row.fixedTargetDays, row.normalDays)).orElse(new Policy(7, 14)));
    }

    @Transactional
    public Policy save(Policy input) {
        var row = repository.findById(1L).orElseGet(FollowUpPolicy::new);
        row.fixedTargetDays = input.fixedTargetDays();
        row.normalDays = input.normalDays();
        row.updatedAt = BusinessTime.now();
        repository.saveAndFlush(row);
        ImportReferenceScope.clear();
        return input;
    }
}
