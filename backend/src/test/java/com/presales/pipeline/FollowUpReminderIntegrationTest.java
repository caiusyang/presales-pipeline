package com.presales.pipeline;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.presales.pipeline.common.config.BusinessTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @WithMockUser(username="跟进规则测试",roles="ADMIN")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class FollowUpReminderIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;

    @Test void cycleBindsOnlyToFixedTargetAndFiltersAllPagesBeforePagination() throws Exception {
        long fresh = project("未到期", true, "高风险", 6);
        long fixed = project("固定靶第7天", true, "无风险", 7);
        project("高风险非固定靶第7天", false, "高风险", 7);
        project("非固定靶第13天", false, "低风险", 13);
        long normal = project("非固定靶第14天", false, "高风险", 14);
        long old = project("长期未跟进", false, null, 30);
        long won = project("已中标", true, "高风险", 30);
        jdbc.update("update projects set project_status='中标' where id=?", won);
        long deleted = project("回收站", true, "高风险", 30);
        mvc.perform(delete("/api/projects/"+deleted).with(csrf())).andExpect(status().isOk());
        long fallback = project("旧项目没有跟进时间", false, null, 14);
        setBusinessTime(fallback,14,true);

        var page = getData("/api/projects?followUpRange=due&size=1&sortBy=id&sortDirection=asc");
        assertEquals(4, page.path("totalElements").asInt());
        assertEquals(fixed, page.path("items").get(0).path("id").asLong());
        var page2 = getData("/api/projects?followUpRange=due&size=1&page=1&sortBy=id&sortDirection=asc");
        assertEquals(normal, page2.path("items").get(0).path("id").asLong());
        assertEquals(1, getData("/api/projects?followUpRange=due&fixedTarget=true").path("totalElements").asInt());
        assertEquals(1, getData("/api/projects?followUpRange=due&projectLevel=高风险").path("totalElements").asInt());
        assertEquals(0, getData("/api/projects?followUpRange=due&deleted=true").path("totalElements").asInt());
        assertEquals(0, getData("/api/projects?followUpRange=due&projectStatus=中标").path("totalElements").asInt());
        assertEquals(1, getData("/api/projects?followUpRange=due&keyword=旧项目").path("totalElements").asInt());
        assertNotEquals(fresh, fixed); assertNotEquals(old, fallback);
        mvc.perform(get("/api/projects").param("projectLevel","重点")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/projects").param("followUpRange","other")).andExpect(status().isBadRequest());

        String unchanged = detail(fixed).path("lastFollowUpAt").asText();
        assertEquals(7, getData("/api/config/follow-up-policy").path("fixedTargetDays").asInt());
        putData("/api/config/follow-up-policy", Map.of("fixedTargetDays",10,"normalDays",20));
        assertEquals(1, getData("/api/projects?followUpRange=due").path("totalElements").asInt());
        assertEquals(unchanged, detail(fixed).path("lastFollowUpAt").asText());
        for (String body : List.of("{\"fixedTargetDays\":0,\"normalDays\":14}", "{\"fixedTargetDays\":7,\"normalDays\":3651}", "{\"fixedTargetDays\":7.5,\"normalDays\":14}", "{\"normalDays\":14}")) {
            mvc.perform(put("/api/config/follow-up-policy").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        assertEquals(10, getData("/api/config/follow-up-policy").path("fixedTargetDays").asInt());
    }

    @Test void newFieldsSupportUpdatesLogsNoopPreservationAndOldRequests() throws Exception {
        long id = project("字段编辑", true, "无风险", 8);
        ObjectNode project = (ObjectNode) detail(id);
        String initial = project.path("lastFollowUpAt").asText();
        assertEquals(initial, putData("/api/projects/"+id, project).path("lastFollowUpAt").asText());
        project.put("projectLevel", "高风险").put("fixedTarget", false);
        JsonNode updated = putData("/api/projects/"+id, project);
        assertFalse(updated.path("fixedTarget").asBoolean());
        assertNotEquals(initial, updated.path("lastFollowUpAt").asText());
        String changed = updated.path("lastFollowUpAt").asText();
        var oldRequest = ((ObjectNode) updated).deepCopy(); oldRequest.remove(List.of("fixedTarget", "projectLevel"));
        assertEquals("高风险", putData("/api/projects/"+id, oldRequest).path("projectLevel").asText());
        assertEquals(changed, detail(id).path("lastFollowUpAt").asText());
        var logs = getData("/api/projects/"+id+"/detail").path("changeLogs");
        assertTrue(logs.findValuesAsText("field").containsAll(List.of("fixedTarget", "projectLevel")));
        project = (ObjectNode) detail(id); project.put("projectLevel", "");
        assertTrue(putData("/api/projects/"+id, project).path("projectLevel").isNull());
        project.put("projectLevel", "重点");
        mvc.perform(put("/api/projects/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(project.toString())).andExpect(status().isBadRequest());
        var legacy = postData("/api/projects", Map.of("customerName","提醒客户","projectName","旧请求","customFields",Map.of()));
        assertFalse(legacy.path("fixedTarget").asBoolean()); assertTrue(legacy.path("projectLevel").isNull());
    }

    @Test void importPreflightIsNonMutatingExportsAndBackupKeepFieldsAndPolicy() throws Exception {
        long id = project("导入已有项目", true, "低风险", 9);
        String unchanged = detail(id).path("lastFollowUpAt").asText();
        var records = List.of(
                record(Map.of("customerName","提醒客户","projectName","导入已有项目")),
                record(Map.of("customerName","提醒客户","projectName","新固定靶","fixed_target","是","project_level","高风险")),
                record(Map.of("customerName","提醒客户","projectName","非固定靶","fixedTarget","0","projectLevel","无风险")),
                record(Map.of("customerName","提醒客户","projectName","待纠正","fixedTarget","待定","projectLevel","重点")));
        long count = jdbc.queryForObject("select count(*) from projects", Long.class);
        var preview = postData("/api/import", Map.of("dryRun",true,"records",records));
        assertEquals(2, preview.path("added").asInt()); assertEquals(1, preview.path("skipped").asInt());
        assertTrue(preview.path("details").get(1).path("effectiveFields").path("fixedTarget").asBoolean());
        assertEquals(count, jdbc.queryForObject("select count(*) from projects", Long.class));
        postData("/api/import", Map.of("dryRun",false,"records",records));
        assertEquals(count+2, jdbc.queryForObject("select count(*) from projects", Long.class));
        assertEquals(unchanged, detail(id).path("lastFollowUpAt").asText());
        assertTrue(detail(id).path("fixedTarget").asBoolean());
        assertEquals("低风险", detail(id).path("projectLevel").asText());

        for (String scope : List.of("projects", "combined")) {
            var exported = postData("/api/export", Map.of("scope",scope,"columns",List.of(Map.of("key","fixedTarget","title","是否固定靶"),Map.of("key","projectLevel","title","项目级别")),"filters",Map.of("projectIds",List.of(id))));
            assertEquals("是", exported.path("rows").get(0).path("fixedTarget").asText());
            assertEquals("低风险", exported.path("rows").get(0).path("projectLevel").asText());
            assertTrue(getData("/api/export/fields?scope="+scope).findValuesAsText("key").containsAll(List.of("fixedTarget","projectLevel")));
        }
        var backup = getData("/api/backup").path("tables");
        assertEquals(7, backup.path("follow_up_policies").get(0).path("fixedTargetDays").asInt());
        var saved = new ArrayList<JsonNode>(); backup.path("projects").forEach(saved::add);
        assertTrue(saved.stream().anyMatch(p -> p.path("id").asLong()==id && p.path("fixedTarget").asBoolean() && p.path("projectLevel").asText().equals("低风险")));
        assertEquals(unchanged, detail(id).path("lastFollowUpAt").asText());
        postData("/api/import", Map.of("dryRun",false,"records",List.of(record(Map.of("customerName","提醒客户","projectName","导入已有项目","projectLevel","")))));
        assertTrue(detail(id).path("projectLevel").isNull());
    }

    @Test void associationCanUseProjectLevelInsteadOfFixedTargetAndDoesNotTouchProjects() throws Exception {
        long high=project("非固定靶高风险",false,"高风险",3);
        project("固定靶无风险未到期",true,"无风险",3);
        project("低风险到期",false,"低风险",7);
        project("未评级默认周期",false,null,14);
        String initial=detail(high).path("lastFollowUpAt").asText();
        var configured=putData("/api/config/follow-up-policy",Map.of("fieldKey","projectLevel","defaultDays",14,"rules",List.of(Map.of("value","高风险","days",3),Map.of("value","低风险","days",7))));
        assertEquals("项目级别",configured.path("fieldLabel").asText());
        var due=getData("/api/projects?followUpRange=due&size=1&sortBy=id&sortDirection=asc");
        assertEquals(3,due.path("totalElements").asInt());assertEquals(high,due.path("items").get(0).path("id").asLong());
        assertEquals(initial,detail(high).path("lastFollowUpAt").asText());
        mvc.perform(put("/api/config/follow-up-policy").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"fixedTargetDays\":7,\"normalDays\":14}")).andExpect(status().isConflict());
        for(var invalid:List.of(
                Map.of("fieldKey","securityBudget","defaultDays",14,"rules",List.of()),
                Map.of("fieldKey","projectLevel","defaultDays",14,"rules",List.of(Map.of("value","不存在","days",3))),
                Map.of("fieldKey","projectLevel","defaultDays",14,"rules",List.of(Map.of("value","高风险","days",3),Map.of("value","高风险","days",7))))) {
            mvc.perform(put("/api/config/follow-up-policy").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        }
        putData("/api/config/follow-up-policy",Map.of("fieldKey","projectLevel","defaultDays",30,"rules",List.of()));
        assertEquals(0,getData("/api/projects?followUpRange=due").path("totalElements").asInt());
    }

    @Test void customTextMatchesBeforePaginationAndRespectsItsTrackScope() throws Exception {
        var def=postData("/api/config/custom-fields",Map.of("fieldKey","follow_class","label","跟进分类","fieldType","text","required",false,"options",List.of(),"sortOrder",99,"applicableTracks",List.of("HCS")));
        assertTrue(getData("/api/config/follow-up-policy/fields").findValuesAsText("key").contains("custom.follow_class"));
        long matches=postData("/api/projects",Map.of("customerName","自定义客户","projectName","HCS命中","track","HCS","customFields",Map.of("follow_class"," VIP "))).path("id").asLong();setBusinessTime(matches,3,false);
        long outside=postData("/api/projects",Map.of("customerName","自定义客户","projectName","公有云不适用","track","公有云","customFields",Map.of("follow_class","VIP"))).path("id").asLong();setBusinessTime(outside,3,false);
        long empty=postData("/api/projects",Map.of("customerName","自定义客户","projectName","空值默认","track","HCS","customFields",Map.of())).path("id").asLong();setBusinessTime(empty,14,false);
        var configured=putData("/api/config/follow-up-policy",Map.of("fieldKey","custom.follow_class","defaultDays",14,"rules",List.of(Map.of("value","vip","days",3))));
        assertEquals("HCS",configured.path("applicableTracks").get(0).asText());
        var due=getData("/api/projects?followUpRange=due&size=1&sortBy=id&sortDirection=asc");
        assertEquals(2,due.path("totalElements").asInt());assertEquals(matches,due.path("items").get(0).path("id").asLong());
        assertEquals(empty,getData("/api/projects?followUpRange=due&size=1&page=1&sortBy=id&sortDirection=asc").path("items").get(0).path("id").asLong());
        assertEquals("custom.follow_class",getData("/api/backup").path("tables").path("follow_up_policies").get(0).path("fieldKey").asText());
        mvc.perform(delete("/api/config/custom-fields/"+def.path("id").asLong()).with(csrf())).andExpect(status().isConflict());
    }

    @Test void unusedFieldsAndDictionaryValuesStillHaveRuleReferenceProtection() throws Exception {
        var def=postData("/api/config/custom-fields",Map.of("fieldKey","follow_tier","label","分层","fieldType","option","required",false,"options",List.of("A","B"),"sortOrder",99));
        long id=def.path("id").asLong();
        putData("/api/config/follow-up-policy",Map.of("fieldKey","custom.follow_tier","defaultDays",14,"rules",List.of(Map.of("value","A","days",3))));
        mvc.perform(delete("/api/config/custom-fields/"+id).with(csrf())).andExpect(status().isConflict());
        var changed=Map.of("fieldKey","follow_tier","label","分层","fieldType","option","required",false,"options",List.of("B"),"sortOrder",99);
        mvc.perform(put("/api/config/custom-fields/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(changed))).andExpect(status().isConflict());
        assertTrue(getData("/api/config/follow-up-policy/fields").toString().contains("\"value\":\"A\""));
        var dict=postData("/api/dictionaries",Map.of("type","industry","value","提醒专用行业","sortOrder",1));
        putData("/api/config/follow-up-policy",Map.of("fieldKey","industry","defaultDays",14,"rules",List.of(Map.of("value","提醒专用行业","days",3))));
        mvc.perform(delete("/api/dictionaries/"+dict.path("id").asLong()).with(csrf())).andExpect(status().isConflict());
        mvc.perform(put("/api/dictionaries/"+dict.path("id").asLong()).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("type","industry","value","改名","sortOrder",1)))).andExpect(status().isConflict());
        putData("/api/config/follow-up-policy",Map.of("fieldKey","industry","defaultDays",14,"rules",List.of()));
        mvc.perform(delete("/api/dictionaries/"+dict.path("id").asLong()).with(csrf())).andExpect(status().isOk());
        mvc.perform(delete("/api/config/custom-fields/"+id).with(csrf())).andExpect(status().isOk());
    }

    private Map<String,Object> record(Map<String,Object> fields) { return Map.of("fields",fields,"revenues",List.of(),"progress",List.of()); }
    private long project(String name, boolean fixed, String level, int days) throws Exception {
        var fields = new HashMap<String,Object>(Map.of("customerName","提醒客户","projectName",name,"customFields",Map.of(),"fixedTarget",fixed));
        if (level != null) fields.put("projectLevel",level);
        long id = postData("/api/projects",fields).path("id").asLong();
        setBusinessTime(id,days,false);
        return id;
    }
    // Bind timestamps with the same JDBC business calendar as Hibernate, not the machine's timezone.
    private void setBusinessTime(long id,int days,boolean fallback) {
        jdbc.update(fallback?"update projects set last_follow_up_at=null,created_at=? where id=?":"update projects set last_follow_up_at=? where id=?", statement -> {
            statement.setTimestamp(1,java.sql.Timestamp.valueOf(LocalDate.now(BusinessTime.ZONE).minusDays(days).atTime(23,59,59)), Calendar.getInstance(TimeZone.getTimeZone(BusinessTime.ZONE)));
            statement.setLong(2,id);
        });
    }
    private JsonNode detail(long id) throws Exception { return getData("/api/projects/"+id+"/detail").path("project"); }
    private JsonNode getData(String path) throws Exception { return mapper.readTree(mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data"); }
    private JsonNode postData(String path,Object body) throws Exception { return mapper.readTree(mvc.perform(post(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data"); }
    private JsonNode putData(String path,Object body) throws Exception { return mapper.readTree(mvc.perform(put(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data"); }
}
