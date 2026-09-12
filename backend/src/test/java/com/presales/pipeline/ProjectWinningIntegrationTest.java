package com.presales.pipeline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(username = "测试管理员", roles = "ADMIN")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectWinningIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void winningRequiresConfiguredHierarchyAndRollbackKeepsSelections() throws Exception {
        long solutionId = createDictionary("solution", "测试云安全方案", null);
        long subSolutionId = createDictionary("sub_solution", "测试边界安全", solutionId);
        long wafId = createDictionary("product", "WAF", subSolutionId);
        createDictionary("product", "AAD", subSolutionId);
        createDictionary("product", "DBSS", subSolutionId);

        long projectId = dataId(mockMvc.perform(post("/api/projects").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(projectJson("机会点识别", "", "", "[]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectStatus").value("机会点识别"))
                .andExpect(jsonPath("$.data.purchasedProducts.length()").value(0))
                .andReturn());

        mockMvc.perform(put("/api/projects/{id}", projectId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(projectJson("中标", "测试云安全方案", "测试边界安全", "[]")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("中标时至少选择一个已购产品"));

        mockMvc.perform(put("/api/projects/{id}", projectId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(projectJson("中标", "测试云安全方案", "测试边界安全",
                                "[\"WAF\",\"AAD\",\"DBSS\"]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectStatus").value("中标"))
                .andExpect(jsonPath("$.data.subSolution").value("测试边界安全"))
                .andExpect(jsonPath("$.data.purchasedProducts.length()").value(3));

        mockMvc.perform(put("/api/projects/{id}", projectId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(projectJson("方案设计", "测试云安全方案", "测试边界安全",
                                "[\"WAF\",\"AAD\",\"DBSS\"]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectStatus").value("方案设计"))
                .andExpect(jsonPath("$.data.purchasedProducts.length()").value(3));

        mockMvc.perform(get("/api/projects/{id}/detail", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.products.length()").value(3))
                .andExpect(jsonPath("$.data.products[0].productCode").value("AAD"))
                .andExpect(jsonPath("$.data.products[1].productCode").value("WAF"))
                .andExpect(jsonPath("$.data.products[2].productCode").value("DBSS"));

        long secondProjectId = dataId(mockMvc.perform(post("/api/projects").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "customerName":"中标测试客户",
                                  "projectName":"客户补充项目",
                                  "projectStatus":"机会点识别",
                                  "purchasedProducts":[],
                                  "customFields":{}
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn());

        mockMvc.perform(put("/api/revenues").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "entries":[
                                    {"projectId":%d,"month":"2026-09","amount":120.50},
                                    {"projectId":%d,"month":"2026-09","amount":80.00}
                                  ]
                                }
                                """.formatted(projectId, secondProjectId)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/customers").param("keyword", "中标测试客户"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].customerName").value("中标测试客户"))
                .andExpect(jsonPath("$.data[0].projectCount").value(2))
                .andExpect(jsonPath("$.data[0].wonProjectCount").value(0))
                .andExpect(jsonPath("$.data[0].statusCounts.方案设计").value(1))
                .andExpect(jsonPath("$.data[0].statusCounts.机会点识别").value(1))
                .andExpect(jsonPath("$.data[0].purchasedProducts.length()").value(3))
                .andExpect(jsonPath("$.data[0].purchasedProducts[0]").value("AAD"))
                .andExpect(jsonPath("$.data[0].purchasedProducts[1]").value("WAF"))
                .andExpect(jsonPath("$.data[0].purchasedProducts[2]").value("DBSS"))
                .andExpect(jsonPath("$.data[0].revenueTotal").value(200.50))
                .andExpect(jsonPath("$.data[0].projects.length()").value(2));

        mockMvc.perform(get("/api/customers").param("keyword", "DBSS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        mockMvc.perform(get("/api/customers").param("keyword", "不存在的客户"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));

        mockMvc.perform(post("/api/dictionaries").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new DictionaryPayload("product", "其他产品", subSolutionId, 30))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("已购产品只能是")));

        mockMvc.perform(get("/api/projects").param("projectStatus", "方案设计"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(projectId));

        mockMvc.perform(get("/api/dictionaries").param("type", "solution"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].children[0].children.length()").value(3));

        mockMvc.perform(delete("/api/dictionaries/{id}", wafId).with(csrf()))
                .andExpect(status().isConflict());
    }

    private long createDictionary(String type, String value, Long parentId) throws Exception {
        String body = objectMapper.writeValueAsString(new DictionaryPayload(type, value, parentId, 10));
        return dataId(mockMvc.perform(post("/api/dictionaries").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn());
    }

    private String projectJson(String status, String solution, String subSolution, String products) {
        return """
                {
                  "customerName":"中标测试客户",
                  "projectName":"中标测试项目",
                  "projectStatus":"%s",
                  "solution":"%s",
                  "subSolution":"%s",
                  "purchasedProducts":%s,
                  "customFields":{}
                }
                """.formatted(status, solution, subSolution, products);
    }

    private long dataId(MvcResult result) throws Exception {
        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        return root.path("data").path("id").asLong();
    }

    private record DictionaryPayload(String type, String value, Long parentId, int sortOrder) {
    }
}
