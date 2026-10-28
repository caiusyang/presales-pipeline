package com.presales.pipeline;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;
@SpringBootTest @AutoConfigureMockMvc @WithMockUser(roles="ADMIN") @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class CatalogSolutionsIntegrationTest {
    @Autowired MockMvc mvc;@Autowired ObjectMapper mapper;
    private JsonNode data(MvcResult result)throws Exception{return mapper.readTree(result.getResponse().getContentAsByteArray()).path("data");}
    private long dict(String type,String value,Long parent)throws Exception{Map<String,Object> body=new HashMap<>();body.put("type",type);body.put("value",value);body.put("parentId",parent);body.put("sortOrder",10);return data(mvc.perform(post("/api/dictionaries").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body))).andExpect(status().isOk()).andReturn()).path("id").asLong();}
    private Map<String,Object> project(String name){var input=new LinkedHashMap<String,Object>();input.put("customerName","验收客户");input.put("projectName",name);input.put("track","HCS");input.put("customFields",Map.of());input.put("purchasedProducts",List.of("HSS"));return input;}
    @Test void multipleSolutionsDeduplicateAndRoundTripWithoutAllocatingRevenue()throws Exception{
        long a=dict("solution","方案验收甲",null),b=dict("solution","方案验收乙",null);dict("sub_solution","细分甲一",a);dict("sub_solution","细分甲二",a);dict("sub_solution","细分乙一",b);
        var input=project("多方案去重验收");input.put("projectStatus","中标");input.put("solutions",List.of(Map.of("solution","方案验收甲","subSolutions",List.of("细分甲一","细分甲二","细分甲一")),Map.of("solution","方案验收乙","subSolutions",List.of("细分乙一")),Map.of("solution","方案验收甲","subSolutions",List.of("细分甲二"))));
        JsonNode created=data(mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andExpect(jsonPath("$.data.solutions",hasSize(2))).andReturn());long id=created.path("id").asLong();
        var stats=data(mvc.perform(get("/api/stats/solutions")).andExpect(status().isOk()).andReturn());
        for(var item:stats.path("items"))if(item.path("id").asLong()==a){assertEquals(1,item.path("projectCount").asInt());assertEquals(2,item.path("subSolutions").size());assertEquals(1,item.path("wonProjectCount").asInt());assertFalse(item.has("revenueTotal"));}
        assertTrue(stats.path("solutionCoverageCount").asInt()>=2);
        mvc.perform(get("/api/projects").param("solution","方案验收甲").param("subSolution","细分甲二")).andExpect(jsonPath("$.data.totalElements").value(1));
        var exported=data(mvc.perform(post("/api/export").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("scope","projects","columns",List.of(Map.of("key","solutions","title","方案集合")),"filters",Map.of("projectIds",List.of(id)))))).andExpect(status().isOk()).andReturn());
        assertEquals(2,mapper.readTree(exported.path("rows").get(0).path("solutions").asText()).size());
        String follow=created.path("lastFollowUpAt").asText();mvc.perform(put("/api/projects/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andExpect(jsonPath("$.data.lastFollowUpAt").value(follow));
        mvc.perform(delete("/api/dictionaries/"+b).with(csrf())).andExpect(status().isConflict());
        mvc.perform(delete("/api/projects/"+id).with(csrf())).andExpect(status().isOk());mvc.perform(delete("/api/projects/"+id+"/permanent").with(csrf())).andExpect(status().isOk());
    }
    @Test void catalogChangesAreImmediateAndDisabledHistoricalSelectionsRemainValid()throws Exception{
        var product=new LinkedHashMap<String,Object>(Map.of("code","CATALOG_NEW","name","目录新产品","aliases",List.of("新别名"),"applicableTracks",List.of("HCS"),"sortOrder",155,"enabled",true));
        long productId=data(mvc.perform(post("/api/config/products").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(product))).andExpect(status().isOk()).andReturn()).path("id").asLong();
        var input=project("目录变更验收");input.put("purchasedProducts",List.of("新别名"));long id=data(mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andExpect(jsonPath("$.data.purchasedProducts[0]").value("CATALOG_NEW")).andReturn()).path("id").asLong();
        product.put("name","目录新名称");product.put("enabled",false);mvc.perform(put("/api/config/products/"+productId).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(product))).andExpect(status().isOk());
        input.put("purchasedProducts",List.of("CATALOG_NEW"));mvc.perform(put("/api/projects/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk());
        input.put("projectName","停用新引用");mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/export/fields").param("scope","projects")).andExpect(jsonPath("$.data[?(@.key == 'product.CATALOG_NEW')].title",contains("目录新名称")));
        product.put("code","RENAMED_CODE");mvc.perform(put("/api/config/products/"+productId).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(product))).andExpect(status().isConflict());
    }
    @Test void trackScopedRequiredFieldsPreserveDataAndFixedTracksCannotExpand()throws Exception{
        mvc.perform(post("/api/config/custom-fields").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"fieldKey\":\"hcs_required\",\"label\":\"HCS专有\",\"fieldType\":\"text\",\"required\":true,\"options\":[],\"sortOrder\":5,\"applicableTracks\":[\"HCS\"]}")).andExpect(status().isOk());
        var input=project("赛道字段验收");mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isBadRequest());
        input.put("customFields",Map.of("hcs_required","保留内容"));long id=data(mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andReturn()).path("id").asLong();
        input.put("track","公有云");mvc.perform(put("/api/projects/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andExpect(jsonPath("$.data.customFields.hcs_required").value("保留内容"));
        mvc.perform(post("/api/dictionaries").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"track\",\"value\":\"数据安全\",\"sortOrder\":10}")).andExpect(status().isBadRequest());
    }
    @Test void backupContainsNewEntitiesAndScopeMetadata()throws Exception{
        mvc.perform(get("/api/backup")).andExpect(status().isOk()).andExpect(jsonPath("$.data.tables.product_catalog",hasSize(greaterThanOrEqualTo(14)))).andExpect(jsonPath("$.data.tables.project_solutions").isArray()).andExpect(jsonPath("$.data.tables.migration_issues").isArray());
    }
}
