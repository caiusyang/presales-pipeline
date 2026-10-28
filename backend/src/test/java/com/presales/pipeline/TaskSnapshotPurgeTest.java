package com.presales.pipeline;

import com.fasterxml.jackson.databind.*;
import com.presales.pipeline.tasks.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @WithMockUser(username="快照测试",roles="ADMIN")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class TaskSnapshotPurgeTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper mapper; @Autowired JobStore store; @Autowired BatchJobRunner runner;
    @Autowired BatchJobRepository jobs; @Autowired BatchJobItemRepository items;
    @Test void hardDeleteErasesRawSnapshotsAndRetryOnlyExportsRemainingProjects() throws Exception {
        var record=Map.of("sourceRow",2,"fields",Map.of("customer_name","保密客户甲","project_name","保密项目甲"),"progress",List.of(Map.of("logDate","2025-09-13","content","保密跟进原文")),"revenues",List.of());
        String imported=submit("/api/import/jobs",Map.of("requestId","private-import","request",Map.of("records",List.of(record),"dryRun",false))).path("id").asText();waitFor(imported);
        long id=mapper.valueToTree(runner.result(imported)).path("details").get(0).path("projectId").asLong();assertTrue(id>0);
        long other=submit("/api/projects",Map.of("customerName","剩余客户","projectName","剩余项目","customFields",Map.of())).path("id").asLong();
        String exported=submit("/api/export/jobs",Map.of("requestId","private-export","request",Map.of("scope","projects","columns",List.of(Map.of("key","projectName","title","项目名称")),"filters",Map.of("projectIds",List.of(id,other))))).path("id").asText();waitFor(exported);assertTrue(mapper.writeValueAsString(runner.result(exported)).contains("保密项目甲"));
        // A queued, not-yet-executed older job must not recreate a purged project on retry.
        var pending=store.submit("old-queued","IMPORT",Map.of("records",List.of(record),"dryRun",false),"快照测试");store.initialize(pending.id,List.of(record),null);store.interrupt(pending.id,"测试中断");
        var detail=mapper.readTree(mvc.perform(get("/api/projects/"+id+"/detail")).andReturn().getResponse().getContentAsString()).path("data");
        long progressId=detail.path("progress").get(0).path("id").asLong();
        store.submit("old-repair","PROGRESS_REPAIR",List.of(Map.of("id",progressId,"expectedContent","保密跟进原文","content","保密修正内容","evidence","保密依据")),"快照测试");
        var renamed=(com.fasterxml.jackson.databind.node.ObjectNode)detail.path("project");renamed.put("projectName","删除前已改名");
        mvc.perform(put("/api/projects/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(renamed.toString())).andExpect(status().isOk());
        mvc.perform(delete("/api/projects/"+id).with(csrf())).andExpect(status().isOk());mvc.perform(delete("/api/projects/"+id+"/permanent").with(csrf())).andExpect(status().isOk());
        String raw=mapper.writeValueAsString(jobs.findAll())+mapper.writeValueAsString(items.findAll());
        assertFalse(raw.contains("保密客户甲"));assertFalse(raw.contains("保密项目甲"));assertFalse(raw.contains("保密跟进原文"));assertFalse(raw.contains("保密依据"));
        String backup=mvc.perform(get("/api/backup")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();assertFalse(backup.contains("保密客户甲"));assertTrue(backup.contains("purged_project_snapshots"));
        assertThrows(Exception.class,()->runner.result(exported));runner.retry(exported,"remaining-only");waitFor(exported);String result=mapper.writeValueAsString(runner.result(exported));assertTrue(result.contains("剩余项目"));assertFalse(result.contains("保密项目甲"));
        runner.retry(pending.id,"cannot-recreate");waitFor(pending.id);assertEquals("FAILED",store.get(pending.id).status);
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$.data.totalElements").value(1));
        // A deliberate new request after deletion remains allowed; only historical tasks are prohibited.
        String fresh=submit("/api/import/jobs",Map.of("requestId","explicit-new","request",Map.of("records",List.of(record),"dryRun",false))).path("id").asText();waitFor(fresh);assertEquals("SUCCEEDED",store.get(fresh).status);
    }
    private JsonNode submit(String path,Object data)throws Exception{return mapper.readTree(mvc.perform(post(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(data))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
    private void waitFor(String id)throws Exception{for(int n=0;n<1000;n++){if(!List.of("QUEUED","RUNNING").contains(store.get(id).status)){Thread.sleep(50);return;}Thread.sleep(10);}fail("任务超时");}
}
