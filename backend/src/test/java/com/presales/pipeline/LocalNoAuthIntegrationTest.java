package com.presales.pipeline;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.security.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:presales-no-auth;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
class LocalNoAuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void localModeAllowsReadsAndWritesWithoutLoginOrCsrf() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value("本地用户"))
                .andExpect(jsonPath("$.data.authenticationEnabled").value(false));

        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "externalId":"LOCAL-001",
                                  "customerName":"本地客户",
                                  "projectName":"免登录测试项目",
                                  "customFields":{}
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectName").value("免登录测试项目"));
    }
}
