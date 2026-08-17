package com.presales.pipeline.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.presales.pipeline.project.Project;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public class ChangeLogService {

    public static final String SOURCE_MANUAL = "manual";
    public static final String SOURCE_IMPORT = "import";

    private final ChangeLogRepository repository;
    private final OperatorProvider operatorProvider;
    private final ObjectMapper objectMapper;

    public ChangeLogService(ChangeLogRepository repository,
                            OperatorProvider operatorProvider,
                            ObjectMapper objectMapper) {
        this.repository = repository;
        this.operatorProvider = operatorProvider;
        this.objectMapper = objectMapper;
    }

    public boolean logIfChanged(Project project, String field, Object oldValue, Object newValue, String source) {
        String oldText = stringify(oldValue);
        String newText = stringify(newValue);
        if (Objects.equals(oldText, newText)) {
            return false;
        }
        repository.save(new ChangeLog(project, operatorProvider.currentOperator(), field, oldText, newText, source));
        return true;
    }

    public void log(Project project, String field, Object oldValue, Object newValue, String source) {
        repository.save(new ChangeLog(project, operatorProvider.currentOperator(), field,
                stringify(oldValue), stringify(newValue), source));
    }

    private String stringify(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String stringValue) {
            return stringValue;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return String.valueOf(value);
        }
    }
}
