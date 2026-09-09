package com.presales.pipeline.audit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class AuthenticatedOperatorProvider implements OperatorProvider {

    private final String fallbackName;

    public AuthenticatedOperatorProvider(@Value("${app.operator.fixed-name}") String fallbackName) {
        this.fallbackName = fallbackName;
    }

    @Override
    public String currentOperator() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)) {
            return authentication.getName();
        }
        return fallbackName;
    }
}
