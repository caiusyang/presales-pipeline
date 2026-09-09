package com.presales.pipeline.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.security")
public record AuthProperties(
        @NotBlank String username,
        @NotBlank @Size(min = 12, message = "管理员密码至少需要 12 个字符") String password
) {
}
