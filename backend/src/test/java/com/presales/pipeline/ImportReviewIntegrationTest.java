package com.presales.pipeline;

import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(username = "测试管理员", roles = "ADMIN")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ImportReviewIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ProjectRepository projects;
    @Autowired CustomFieldDefinitionRepository fields;

    @Test
    void previewCollectsAllIssuesAndDoesNotConsumeDuplicateOrCreateFields() throws Exception {
        long beforeProjects = projects.count(), beforeFields = fields.count();
        String body = """
                {"dryRun":true,"pendingFields":[{"fieldKey":"review_date","label":"回访日期","fieldType":"date"}],"records":[
                  {"sourceRow":7,"fields":{"externalId":"REVIEW-001","projectName":"评估项目","projectStatus":"洽谈","securityBudget":-1,"customFields":{"review_date":"2026-02-30"}},"revenues":[],"progress":[]},
                  {"sourceRow":9,"fields":{"externalId":"REVIEW-001","customerName":"评估客户","projectName":"评估项目","projectStatus":"方案引导","customFields":{"review_date":"2026-10-10"}},"revenues":[],"progress":[]}
                ]}
                """;
        mvc.perform(post("/api/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.added").value(1))
                .andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.details[0].sourceRow").value(7))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'customerName')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'projectStatus')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'securityBudget')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'custom.review_date')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[1].status").value("added"));
        assertEquals(beforeProjects, projects.count()); assertEquals(beforeFields, fields.count());

        mvc.perform(post("/api/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body.replace("\"dryRun\":true", "\"dryRun\":false")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(1)).andExpect(jsonPath("$.data.skipped").value(1));
        assertEquals(beforeProjects + 1, projects.count()); assertEquals(beforeFields + 1, fields.count());
    }

    @Test
    void updatesInheritMissingFieldsAndDuplicateMatchingUsesResolvedProject() throws Exception {
        mvc.perform(post("/api/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"dryRun":false,"records":[{"fields":{"externalId":"REVIEW-002","customerName":"原客户","projectName":"原项目","customFields":{}},"revenues":[],"progress":[]}]}
                """)).andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(1));
        mvc.perform(post("/api/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"dryRun":true,"records":[
                  {"sourceRow":4,"fields":{"externalId":"REVIEW-002","projectStatus":"方案设计"},"revenues":[],"progress":[]},
                  {"sourceRow":8,"fields":{"customerName":"原客户","projectName":"原项目"},"revenues":[],"progress":[]}
                ]}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.overwritten").value(1)).andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.details[0].effectiveFields.customerName").value("原客户"))
                .andExpect(jsonPath("$.data.details[0].effectiveFields.projectName").value("原项目"))
                .andExpect(jsonPath("$.data.details[1].issues[0].code").value("duplicate"));
    }

    @Test
    void wonRequirementsAndSubrecordErrorsRemainRowLevelAndFieldsAreNotCreatedForRejectedRows() throws Exception {
        long before = fields.count();
        mvc.perform(post("/api/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"dryRun":false,"pendingFields":[{"fieldKey":"only_rejected","label":"仅失败行使用","fieldType":"text"}],"records":[
                  {"sourceRow":5,"fields":{"customerName":"中标客户","projectName":"中标项目","projectStatus":"中标","customFields":{"only_rejected":"不应创建"}},
                   "revenues":[{"month":"2026-13","amount":-1}],"progress":[{"logDate":null,"content":""}]},
                  {"sourceRow":6,"fields":{"customerName":"中标校验旁路客户","projectName":"中标校验旁路项目","customFields":{}},"revenues":[],"progress":[]}
                ]}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(1)).andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'solution')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'subSolution')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'purchasedProducts')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'revenues.0')]", hasSize(1)));
        assertEquals(before, fields.count());
    }

    @Test
    void invalidDictionaryValuesAreReportedTogetherWithoutExpandingDictionary() throws Exception {
        for (String type : new String[]{"industry", "track", "solution"}) {
            mvc.perform(post("/api/dictionaries").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(
                    "{\"type\":\"" + type + "\",\"value\":\"标准值\",\"parentId\":null,\"sortOrder\":0}"))
                    .andExpect(status().isOk());
        }
        mvc.perform(post("/api/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"dryRun":true,"records":[{"fields":{"customerName":"字典客户","projectName":"字典项目","industry":"旧行业","track":"旧赛道","solution":"旧方案","customFields":{}},"revenues":[],"progress":[]}]}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.skipped").value(1))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'industry')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'track')]", hasSize(1)))
                .andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'solution')]", hasSize(1)));
    }
}
