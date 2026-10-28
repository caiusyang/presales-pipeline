package com.presales.pipeline;
import com.fasterxml.jackson.databind.*;
import com.presales.pipeline.progress.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @WithMockUser(username="跟进测试",roles="ADMIN")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class FollowUpAndProgressTest {
    @Autowired MockMvc mvc;@Autowired ObjectMapper mapper;@Autowired ProgressRepairService repairs;@Autowired ProgressLogRepository logs;
    @Test void actualBusinessChangesTouchFollowupButNoopsAndHistoricalDuplicatesDoNot()throws Exception{
        var project=post("/api/projects",Map.of("customerName","客户","projectName","项目","customFields",Map.of()));long id=project.path("id").asLong();
        String initial=project.path("lastFollowUpAt").asText();assertFalse(initial.isBlank());
        Thread.sleep(10);mvc.perform(put("/api/projects/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(project.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.data.lastFollowUpAt").value(initial));
        post("/api/progress",Map.of("projectId",id,"logDate","2025-09-13","content","历史业务"));
        var detail=getData("/api/projects/"+id+"/detail");String afterProgress=detail.path("project").path("lastFollowUpAt").asText();assertNotEquals(initial,afterProgress);
        assertEquals("2025-09-13",detail.path("progress").get(0).path("logDate").asText());assertTrue(detail.path("progress").get(0).path("createdAt").asText().startsWith(LocalDate.now(ZoneId.of("Asia/Shanghai")).toString()));
        var record=Map.of("fields",Map.of("customerName","客户","projectName","项目"),"revenues",List.of(),"progress",List.of(Map.of("logDate","2025-09-13","content","历史业务")));
        post("/api/import",Map.of("dryRun",false,"records",List.of(record)));
        assertEquals(afterProgress,getData("/api/projects/"+id+"/detail").path("project").path("lastFollowUpAt").asText());
        String body=mapper.writeValueAsString(Map.of("entries",List.of(Map.of("projectId",id,"month","2025-09","amount",10))));
        mvc.perform(put("/api/revenues").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        String afterRevenue=getData("/api/projects/"+id+"/detail").path("project").path("lastFollowUpAt").asText();assertNotEquals(afterProgress,afterRevenue);
        mvc.perform(put("/api/revenues").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        assertEquals(afterRevenue,getData("/api/projects/"+id+"/detail").path("project").path("lastFollowUpAt").asText());
    }
    @Test void actionSortAndFiltersAreAppliedBeforePaginationAndCompletionIsExplicit()throws Exception{
        var today=LocalDate.now(ZoneId.of("Asia/Shanghai"));long unscheduled=project("未安排",null),future=project("未来",today.plusDays(7)),due=project("今天",today),late=project("逾期",today.minusDays(1));
        var page=getData("/api/projects?size=1");assertEquals(late,page.path("items").get(0).path("id").asLong());
        assertEquals(due,getData("/api/projects?actionRange=today&size=1").path("items").get(0).path("id").asLong());
        assertEquals(future,getData("/api/projects?actionRange=next7").path("items").get(0).path("id").asLong());
        assertEquals(unscheduled,getData("/api/projects?actionRange=unscheduled").path("items").get(0).path("id").asLong());
        assertEquals(unscheduled,getData("/api/projects?sortBy=id&sortDirection=asc&size=1").path("items").get(0).path("id").asLong());
        post("/api/projects/"+late+"/complete-action",new HashMap<>(Map.of("nextActionNote","已完成")));
        assertTrue(getData("/api/projects/"+late+"/detail").path("project").path("nextActionDate").isNull());
        mvc.perform(get("/api/projects").param("actionRange","invalid")).andExpect(status().isBadRequest());
    }
    @Test void progressRepairOnlySuggestsEvidenceBasedDatesAndPreservesCreatedTime()throws Exception{
        long id=project("日期修复",null);
        var original=post("/api/progress",Map.of("projectId",id,"logDate","2026-10-28","content","2025-09-13：交流"));
        post("/api/progress",Map.of("projectId",id,"logDate","2026-10-28","content","9月13日：年份未知"));
        var preview=getData("/api/progress/repair");assertEquals("repairable",preview.path("items").get(0).path("classification").asText());assertEquals("manual",preview.path("items").get(1).path("classification").asText());
        long log=original.path("id").asLong();var request=new ProgressRepairService.Repair(log,LocalDate.of(2026,10,28),"2025-09-13：交流",LocalDate.of(2025,9,13),"交流","原文完整日期");
        repairs.apply(request);assertEquals(original.path("createdAt").asText(),mapper.valueToTree(logs.findById(log).orElseThrow().getCreatedAt()).asText());
        assertThrows(RuntimeException.class,()->repairs.apply(request));assertEquals(LocalDate.of(2025,9,13),logs.findById(log).orElseThrow().getLogDate());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/progress").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("projectId",id,"logDate","2026-02-30","content","错误日期")))).andExpect(status().isBadRequest());
    }
    private long project(String name,LocalDate date)throws Exception{var input=new HashMap<String,Object>(Map.of("customerName","提醒客户","projectName",name,"customFields",Map.of()));if(date!=null)input.put("nextActionDate",date.toString());return post("/api/projects",input).path("id").asLong();}
    private JsonNode post(String path,Object input)throws Exception{return mapper.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
    private JsonNode getData(String path)throws Exception{return mapper.readTree(mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
}
