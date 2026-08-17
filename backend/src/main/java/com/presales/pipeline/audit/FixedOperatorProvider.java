package com.presales.pipeline.audit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FixedOperatorProvider implements OperatorProvider {

    private final String fixedName;

    public FixedOperatorProvider(@Value("${app.operator.fixed-name}") String fixedName) {
        this.fixedName = fixedName;
    }

    @Override
    public String currentOperator() {
        return fixedName;
    }
}
