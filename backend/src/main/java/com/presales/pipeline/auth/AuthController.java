package com.presales.pipeline.auth;

import com.presales.pipeline.common.api.ApiResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthProperties properties;

    public AuthController(AuthProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/csrf")
    public ApiResponse<CsrfResponse> csrf(HttpServletRequest request) {
        Object attribute = request.getAttribute(CsrfToken.class.getName());
        if (!(attribute instanceof CsrfToken token)) {
            return ApiResponse.success(new CsrfResponse(null, null, null));
        }
        return ApiResponse.success(new CsrfResponse(token.getHeaderName(), token.getParameterName(), token.getToken()));
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me(Authentication authentication) {
        if (!properties.enabled()) {
            return ApiResponse.success(new UserResponse("本地用户", List.of("ROLE_ADMIN"), false));
        }
        return ApiResponse.success(userResponse(authentication, properties.enabled()));
    }

    public static UserResponse userResponse(Authentication authentication) {
        return userResponse(authentication, true);
    }

    private static UserResponse userResponse(Authentication authentication, boolean authenticationEnabled) {
        List<String> roles = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .toList();
        return new UserResponse(authentication.getName(), roles, authenticationEnabled);
    }

    public record CsrfResponse(String headerName, String parameterName, String token) {
    }

    public record UserResponse(String username, List<String> roles, boolean authenticationEnabled) {
    }
}
