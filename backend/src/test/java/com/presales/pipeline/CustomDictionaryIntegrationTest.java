package com.presales.pipeline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import com.presales.pipeline.dictionary.DictionaryRepository;
import com.presales.pipeline.project.ProjectRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(username = "测试管理员", roles = "ADMIN")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class CustomDictionaryIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired DictionaryRepository dictionaries;
    @Autowired ProjectRepository projects;
    @Autowired CustomFieldDefinitionRepository fields;

    @Test
    void categoriesHaveStableKeysAndProtectBuiltinsAndAssociations() throws Exception {
        JsonNode categories = data(mvc.perform(get("/api/dictionary-categories")).andExpect(status().isOk()).andReturn());
        assertEquals(4, categories.size());
        long builtinId = categories.get(0).path("id").asLong();
        mvc.perform(delete("/api/dictionary-categories/{id}", builtinId).with(csrf())).andExpect(status().isConflict());
        mvc.perform(post("/api/dictionary-categories").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type":"sub_solution","label":"保留分类","sortOrder":1}
                        """))
                .andExpect(status().isConflict());
        long id = category("region", "客户区域");
        mvc.perform(put("/api/dictionary-categories/{id}", id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type":"region","label":"业务区域","sortOrder":3}
                        """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.label").value("业务区域"));
        mvc.perform(put("/api/dictionary-categories/{id}", id).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type":"new_region","label":"业务区域","sortOrder":3}
                        """))
                .andExpect(status().isConflict());
        long item = item("region", "华东", null);
        mvc.perform(delete("/api/dictionary-categories/{id}", id).with(csrf())).andExpect(status().isConflict());
        mvc.perform(delete("/api/dictionaries/{id}", item).with(csrf())).andExpect(status().isOk());
        long field = linkedField("customer_region", "region", false);
        mvc.perform(delete("/api/dictionary-categories/{id}", id).with(csrf())).andExpect(status().isConflict());
        mvc.perform(delete("/api/config/custom-fields/{id}", field).with(csrf())).andExpect(status().isOk());
        // A deleted field can be restored, so its dictionary association still protects the category.
        mvc.perform(delete("/api/dictionary-categories/{id}", id).with(csrf())).andExpect(status().isConflict());
        long empty = category("unused_region", "未使用分类");
        mvc.perform(delete("/api/dictionary-categories/{id}", empty).with(csrf())).andExpect(status().isOk());
        mvc.perform(get("/api/dictionary-categories")).andExpect(jsonPath("$.data[?(@.type == 'unused_region')]", hasSize(0)));
    }

    @Test
    void dictionaryImportPreviewsWithoutWritesAndContinuesPastInvalidRows() throws Exception {
        category("region", "客户区域");
        item("region", "已有", null);
        List<Map<String, Object>> records = List.of(row(2, "已有"), row(3, " Alpha "), row(4, "alpha"),
                row(5, "  "), row(6, "华东"), row(7, "长".repeat(256)));
        long before = dictionaries.count();
        String preview = mapper.writeValueAsString(Map.of("type", "region", "dryRun", true, "records", records));
        mvc.perform(post("/api/dictionaries/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(preview))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(2))
                .andExpect(jsonPath("$.data.skipped").value(2)).andExpect(jsonPath("$.data.failed").value(2))
                .andExpect(jsonPath("$.data.details[1].sourceRow").value(3)).andExpect(jsonPath("$.data.details[1].value").value("Alpha"));
        assertEquals(before, dictionaries.count());
        String formal = mapper.writeValueAsString(Map.of("type", "region", "dryRun", false, "records", records));
        mvc.perform(post("/api/dictionaries/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(formal))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(2)).andExpect(jsonPath("$.data.failed").value(2));
        assertEquals(before + 2, dictionaries.count());
        mvc.perform(post("/api/dictionaries/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(formal))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(0)).andExpect(jsonPath("$.data.skipped").value(4));
    }

    @Test
    void dictionaryImportRejectsBatchBoundsAndDoesNotRegisterUnknownCategoriesDuringPreview() throws Exception {
        category("region", "客户区域");
        long itemCount = dictionaries.count();
        long fieldCount = fields.count();
        for (List<Map<String, Object>> records : List.of(List.<Map<String, Object>>of(), java.util.Collections.nCopies(5001, row(2, "华东")))) {
            mvc.perform(post("/api/dictionaries/import").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(Map.of("type", "region", "dryRun", false, "records", records))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("1至5000")));
        }
        mvc.perform(post("/api/dictionaries/import").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("type", "unknown_region", "dryRun", true, "records", List.of(row(5, "华东"))))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.failed").value(1))
                .andExpect(jsonPath("$.data.details[0].reason").value(org.hamcrest.Matchers.containsString("分类不存在")));
        assertEquals(itemCount, dictionaries.count());
        assertEquals(fieldCount, fields.count());
        mvc.perform(get("/api/dictionary-categories")).andExpect(jsonPath("$.data[?(@.type == 'unknown_region')]", hasSize(0)));
    }

    @Test
    void linkedFieldsResolveLiveOptionsAndEnforceEmptyAndTypeRules() throws Exception {
        category("region", "客户区域");
        long optional = linkedField("customer_region", "region", false);
        mvc.perform(get("/api/config/custom-fields/{id}", optional)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dictionaryType").value("region")).andExpect(jsonPath("$.data.options", hasSize(0)));
        mvc.perform(post("/api/config/custom-fields").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(fieldJson("required_region", "region", true, "option"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/config/custom-fields").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(fieldJson("text_region", "region", false, "text"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/config/custom-fields").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(fieldJson("builtin_region", "industry", false, "option"))).andExpect(status().isBadRequest());
        long value = item("region", "华东", null);
        long required = linkedField("required_region", "region", true);
        mvc.perform(get("/api/config/custom-fields/{id}", required)).andExpect(jsonPath("$.data.options[0]").value("华东"));
        mvc.perform(delete("/api/dictionaries/{id}", value).with(csrf())).andExpect(status().isConflict());
        mvc.perform(post("/api/dictionaries").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("type", "region", "value", "错误上级", "parentId", value, "sortOrder", 20))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void restoringDeletedLinkedFieldRevalidatesOptionsAndExistingProjectValues() throws Exception {
        category("region", "客户区域");
        long value = item("region", "华东", null);
        long field = linkedField("required_region", "region", true);
        mvc.perform(delete("/api/config/custom-fields/{id}", field).with(csrf())).andExpect(status().isOk());
        mvc.perform(delete("/api/dictionaries/{id}", value).with(csrf())).andExpect(status().isOk());
        mvc.perform(post("/api/config/custom-fields/{id}/restore", field).with(csrf())).andExpect(status().isBadRequest());
        assertTrue(fields.findById(field).orElseThrow().isDeleted());
        item("region", "华南", null);
        mvc.perform(post("/api/config/custom-fields/{id}/restore", field).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.options[0]").value("华南"));
        assertFalse(fields.findById(field).orElseThrow().isDeleted());

        mvc.perform(delete("/api/config/custom-fields/{id}", field).with(csrf())).andExpect(status().isOk());
        mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"customerName":"恢复校验客户","projectName":"字段删除后新增的项目","customFields":{}}
                        """))
                .andExpect(status().isOk());
        mvc.perform(post("/api/config/custom-fields/{id}/restore", field).with(csrf())).andExpect(status().isConflict());
        assertTrue(fields.findById(field).orElseThrow().isDeleted());
    }

    @Test
    void linkedDictionaryReferencesNormalizeLegacyNumericCustomValues() throws Exception {
        category("quantity", "采购档位");
        long value = item("quantity", "1", null);
        long field = data(mvc.perform(post("/api/config/custom-fields").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"fieldKey":"purchase_count","label":"采购数量","fieldType":"number","required":false,"options":[],"sortOrder":10}
                        """))
                .andExpect(status().isOk()).andReturn()).path("id").asLong();
        long active = numericProject("活动数字项目");
        long recycled = numericProject("回收数字项目");
        mvc.perform(delete("/api/projects/{id}", recycled).with(csrf())).andExpect(status().isOk());
        mvc.perform(put("/api/config/custom-fields/{id}", field).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(fieldJson("purchase_count", "quantity", false, "option")))
                .andExpect(status().isOk());
        assertInstanceOf(Number.class, projects.findById(active).orElseThrow().getCustomFields().get("purchase_count"));
        mvc.perform(delete("/api/dictionaries/{id}", value).with(csrf())).andExpect(status().isConflict());
        mvc.perform(put("/api/dictionaries/{id}", value).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type":"quantity","value":"一级","parentId":null,"sortOrder":10}
                        """))
                .andExpect(status().isOk());
        assertEquals("一级", projects.findById(active).orElseThrow().getCustomFields().get("purchase_count"));
        assertEquals("一级", projects.findById(recycled).orElseThrow().getCustomFields().get("purchase_count"));
        mvc.perform(get("/api/projects/{id}/detail", active)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.changeLogs[?(@.field == 'custom.purchase_count')]", hasSize(1)));
        mvc.perform(delete("/api/projects/{id}", active).with(csrf())).andExpect(status().isOk());
        mvc.perform(delete("/api/dictionaries/{id}", value).with(csrf())).andExpect(status().isConflict());
    }

    @Test
    void linkedDictionaryValidationRenameAndReferenceGuardsIncludeRecycledProjects() throws Exception {
        category("region", "客户区域");
        long value = item("region", "华东", null);
        linkedField("customer_region", "region", false);
        long active = project("活动项目", "华东");
        long recycled = project("回收项目", "华东");
        mvc.perform(delete("/api/projects/{id}", recycled).with(csrf())).andExpect(status().isOk());
        mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(projectJson("非法项目", "其他")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("""
                {"dryRun":true,"records":[{"fields":{"customerName":"导入客户","projectName":"导入项目","customFields":{"customer_region":"其他"}},"revenues":[],"progress":[]}]}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.details[0].issues[?(@.field == 'custom.customer_region')]", hasSize(1)));
        mvc.perform(put("/api/dictionaries/{id}", value).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"type":"region","value":"华东地区","parentId":null,"sortOrder":10}
                        """))
                .andExpect(status().isOk());
        assertEquals("华东地区", projects.findById(active).orElseThrow().getCustomFields().get("customer_region"));
        assertEquals("华东地区", projects.findById(recycled).orElseThrow().getCustomFields().get("customer_region"));
        mvc.perform(get("/api/projects/{id}/detail", active)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.changeLogs[?(@.field == 'custom.customer_region')]", hasSize(1)));
        mvc.perform(delete("/api/dictionaries/{id}", value).with(csrf())).andExpect(status().isConflict());
        mvc.perform(delete("/api/projects/{id}", active).with(csrf())).andExpect(status().isOk());
        mvc.perform(delete("/api/dictionaries/{id}", value).with(csrf())).andExpect(status().isConflict());
        mvc.perform(get("/api/backup")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tables.dictionary_categories[?(@.type == 'region')].label").value(hasSize(1)))
                .andExpect(jsonPath("$.data.tables.custom_field_definitions[0].dictionaryType").value("region"));
    }

    @Test
    void productImportRetainsFixedCatalogAndHierarchyValidation() throws Exception {
        long solution = item("solution", "云安全", null);
        long sub = item("sub_solution", "网络防护", solution);
        String body = mapper.writeValueAsString(Map.of("type", "product", "parentId", sub, "dryRun", false,
                "records", List.of(row(2, "其他产品"), row(3, "waf"), row(4, "WAF"), row(5, "HSS"))));
        mvc.perform(post("/api/dictionaries/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.added").value(2))
                .andExpect(jsonPath("$.data.skipped").value(1)).andExpect(jsonPath("$.data.failed").value(1))
                .andExpect(jsonPath("$.data.details[1].value").value("WAF"));
        mvc.perform(post("/api/dictionaries/import").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("type", "product", "parentId", solution, "dryRun", true, "records", List.of(row(7, "AAD"))))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.failed").value(1));
        item("legacy_custom", "保留值", null);
        mvc.perform(get("/api/dictionary-categories")).andExpect(jsonPath("$.data[?(@.type == 'legacy_custom')]", hasSize(1)));
    }

    private long category(String type, String label) throws Exception {
        return data(mvc.perform(post("/api/dictionary-categories").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("type", type, "label", label, "sortOrder", 100))))
                .andExpect(status().isOk()).andReturn()).path("id").asLong();
    }
    private long item(String type, String value, Long parentId) throws Exception {
        var body = new java.util.LinkedHashMap<String, Object>();
        body.put("type", type); body.put("value", value); body.put("parentId", parentId); body.put("sortOrder", 10);
        return data(mvc.perform(post("/api/dictionaries").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
                .andExpect(status().isOk()).andReturn()).path("id").asLong();
    }
    private long linkedField(String key, String dictionary, boolean required) throws Exception {
        return data(mvc.perform(post("/api/config/custom-fields").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(fieldJson(key, dictionary, required, "option"))).andExpect(status().isOk()).andReturn()).path("id").asLong();
    }
    private String fieldJson(String key, String dictionary, boolean required, String fieldType) throws Exception {
        return mapper.writeValueAsString(Map.of("fieldKey", key, "label", "客户区域", "fieldType", fieldType,
                "dictionaryType", dictionary, "required", required, "options", List.of(), "sortOrder", 10));
    }
    private long project(String name, String value) throws Exception {
        return data(mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(projectJson(name, value)))
                .andExpect(status().isOk()).andReturn()).path("id").asLong();
    }
    private String projectJson(String name, String value) throws Exception {
        return mapper.writeValueAsString(Map.of("customerName", "测试客户", "projectName", name, "customFields", Map.of("customer_region", value)));
    }
    private long numericProject(String name) throws Exception {
        return data(mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("customerName", "数字客户", "projectName", name, "customFields", Map.of("purchase_count", 1)))))
                .andExpect(status().isOk()).andReturn()).path("id").asLong();
    }
    private Map<String, Object> row(int sourceRow, String value) { return Map.of("sourceRow", sourceRow, "value", value); }
    private JsonNode data(MvcResult result) throws Exception { return mapper.readTree(result.getResponse().getContentAsString()).path("data"); }
}
