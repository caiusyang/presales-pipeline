package com.presales.pipeline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(username = "测试管理员", roles = "ADMIN")
class ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void completeBusinessFlowWorks() throws Exception {
        long trackId = dataId(mockMvc.perform(post("/api/dictionaries").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"track","value":"数据安全","parentId":null,"sortOrder":10}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andReturn());

        mockMvc.perform(put("/api/dictionaries/{id}", trackId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"type":"track","value":"数据安全","parentId":null,"sortOrder":20}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sortOrder").value(20));

        long customFieldId = dataId(mockMvc.perform(post("/api/config/custom-fields").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fieldKey":"stage",
                                  "label":"项目阶段",
                                  "fieldType":"option",
                                  "required":false,
                                  "options":["初访","方案"],
                                  "sortOrder":10
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fieldKey").value("stage"))
                .andReturn());

        mockMvc.perform(put("/api/config/custom-fields/{id}", customFieldId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fieldKey":"stage",
                                  "label":"销售阶段",
                                  "fieldType":"option",
                                  "required":false,
                                  "options":["初访","方案"],
                                  "sortOrder":20
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.label").value("销售阶段"));

        long mappingId = dataId(mockMvc.perform(post("/api/config/import-mappings").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"测试映射","columnMap":{},"valueRules":[]}
                                """))
                .andExpect(status().isOk())
                .andReturn());
        mockMvc.perform(get("/api/config/import-mappings/{id}", mappingId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("测试映射"));

        long templateId = dataId(mockMvc.perform(post("/api/config/export-templates").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"测试主表",
                                  "scope":"projects",
                                  "columns":[
                                    {"key":"externalId","title":"项目编号"},
                                    {"key":"projectName","title":"项目名称"},
                                    {"key":"revenueTotal","title":"收入合计"}
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn());

        long projectId = dataId(mockMvc.perform(post("/api/projects").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "externalId":"EXT-001",
                                  "customerName":"示例银行",
                                  "projectName":"数据安全治理",
                                  "safetySpace":"数据域",
                                  "solution":"安全咨询",
                                  "track":"数据安全",
                                  "industry":"金融",
                                  "subIndustry":null,
                                  "scenario":"核心数据治理",
                                  "keyRisks":"口径待统一",
                                  "keyNeeds":"形成路线图",
                                  "customFields":{"stage":"初访"}
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.revenueTotal").value(0))
                .andReturn());

        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andExpect(jsonPath("$.data.totalElements").value(1));

        mockMvc.perform(delete("/api/dictionaries/{id}", trackId).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(40900));

        mockMvc.perform(post("/api/progress").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"projectId":%d,"logDate":"2026-08-18","content":"完成首次需求访谈"}
                                """.formatted(projectId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("完成首次需求访谈"));

        mockMvc.perform(put("/api/revenues").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"entries":[
                                  {"projectId":%d,"month":"2026-08","amount":120.00},
                                  {"projectId":%d,"month":"2026-09","amount":80.00}
                                ]}
                                """.formatted(projectId, projectId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.created").value(2));

        mockMvc.perform(get("/api/revenues").param("year", "2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.months", hasSize(12)))
                .andExpect(jsonPath("$.data.rows[0].total").value(200.0));

        mockMvc.perform(get("/api/stats/revenue").param("dim", "industry").param("year", "2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(200.0))
                .andExpect(jsonPath("$.data.items[0].label").value("金融"));

        mockMvc.perform(put("/api/projects/{id}", projectId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "externalId":"EXT-001",
                                  "customerName":"示例银行",
                                  "projectName":"数据安全治理一期",
                                  "safetySpace":"数据域",
                                  "solution":"平台建设",
                                  "track":"数据安全",
                                  "industry":"金融",
                                  "subIndustry":null,
                                  "scenario":"核心数据治理",
                                  "keyRisks":"口径待统一",
                                  "keyNeeds":"形成分阶段路线图",
                                  "customFields":{"stage":"方案"}
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectName").value("数据安全治理一期"));

        mockMvc.perform(get("/api/projects/{id}/detail", projectId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.progress", hasSize(1)))
                .andExpect(jsonPath("$.data.revenues", hasSize(2)))
                .andExpect(jsonPath("$.data.changeLogs[0].operator").value("测试管理员"))
                .andExpect(jsonPath("$.data.changeLogs.length()").value(greaterThan(5)));

        String importPayload = """
                {
                  "mappingId":%d,
                  "dryRun":%s,
                  "records":[{
                    "fields":{
                      "externalId":"EXT-002",
                      "customerName":"示例政务云",
                      "projectName":"云安全运营",
                      "customFields":{}
                    },
                    "revenues":[{"month":"2026-10","amount":300.00}],
                    "progress":[{"logDate":"2026-08-18","content":"完成资料收集"}]
                  }]
                }
                """;

        mockMvc.perform(post("/api/import").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(importPayload.formatted(mappingId, true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dryRun").value(true))
                .andExpect(jsonPath("$.data.added").value(1));

        mockMvc.perform(post("/api/import").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(importPayload.formatted(mappingId, false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.added").value(1))
                .andExpect(jsonPath("$.data.details[0].projectId").isNumber());

        mockMvc.perform(post("/api/export").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "templateId":null,
                                  "scope":"projects",
                                  "columns":[
                                    {"key":"externalId","title":"项目编号"},
                                    {"key":"projectName","title":"项目名称"},
                                    {"key":"revenueTotal","title":"收入合计"}
                                  ],
                                  "filters":{"startMonth":"2026-01","endMonth":"2026-12"}
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows").value(2))
                .andExpect(jsonPath("$.data.rows[0].revenueTotal").value(200.0));

        mockMvc.perform(post("/api/export").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "templateId":%d,
                                  "filters":{"startMonth":"2026-01","endMonth":"2026-12"}
                                }
                                """.formatted(templateId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows").value(2))
                .andExpect(jsonPath("$.data.columns", hasSize(3)));

        mockMvc.perform(get("/api/backup"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("presales-pipeline-backup")))
                .andExpect(jsonPath("$.data.tables.projects", hasSize(2)))
                .andExpect(jsonPath("$.data.tables.change_logs.length()").value(greaterThan(5)));

        mockMvc.perform(delete("/api/projects/{id}", projectId).with(csrf()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/projects/{id}/detail", projectId))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/projects/{id}/restore", projectId).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted").value(false));

        mockMvc.perform(post("/api/import").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "dryRun":false,
                                  "records":[
                                    {
                                      "fields":{"externalId":"BAD-001","customerName":"坏数据客户","projectName":"金额错误","customFields":{}},
                                      "revenues":[{"month":"2026-11","amount":1.234}],
                                      "progress":[]
                                    },
                                    {
                                      "fields":{"externalId":"EXT-003","customerName":"有效客户","projectName":"有效项目","customFields":{}},
                                      "revenues":[],
                                      "progress":[]
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.added").value(1))
                .andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.details[0].status").value("skipped"))
                .andExpect(jsonPath("$.data.details[1].status").value("added"));
    }

    private long dataId(MvcResult result) throws Exception {
        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        return root.path("data").path("id").asLong();
    }
}
