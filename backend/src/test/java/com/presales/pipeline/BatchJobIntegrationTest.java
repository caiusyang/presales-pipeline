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

@SpringBootTest @AutoConfigureMockMvc @WithMockUser(username="任务测试",roles="ADMIN")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class BatchJobIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper mapper; @Autowired JobStore store; @Autowired BatchJobRunner runner; @Autowired JobItemWorker worker;
    @Test void partialFailureAndIdempotentRetryNeverReexecutesSuccessfulPurge() throws Exception {
        long a=project("A"), b=project("B");mvc.perform(delete("/api/projects/"+a).with(csrf())).andExpect(status().isOk());
        var input=Map.of("requestId","purge-test","operation","purge","projectIds",List.of(a,b));
        String id=submit("/api/projects/batch",input).path("id").asText();
        assertEquals(id,submit("/api/projects/batch",input).path("id").asText());
        waitFor(id);assertEquals("PARTIAL",store.get(id).status);
        var result=runner.result(id);assertTrue(mapper.valueToTree(result).path("deletedIds").toString().contains(String.valueOf(a)));
        mvc.perform(post("/api/projects/batch").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("requestId","purge-test","operation","delete","projectIds",List.of(b))))).andExpect(status().isConflict());
        mvc.perform(delete("/api/projects/"+b).with(csrf())).andExpect(status().isOk());
        runner.retry(id,"retry-1");waitFor(id);assertEquals("SUCCEEDED",store.get(id).status);assertEquals(2,store.get(id).succeeded);
        assertEquals(2,store.results(id).size());assertTrue(store.results(id).stream().allMatch(i->i.status.equals("SUCCESS")));
        runner.retry(id,"retry-1");assertEquals("SUCCEEDED",store.get(id).status);
    }
    @Test void previewRetainsCorrectableIssuesAndFormalResultsPersist() throws Exception {
        var records=List.of(Map.of("sourceRow",2,"fields",Map.of("customerName","甲","projectName","一"),"revenues",List.of(),"progress",List.of()),Map.of("sourceRow",3,"fields",Map.of("projectName","二"),"revenues",List.of(),"progress",List.of()));
        var request=Map.of("dryRun",true,"records",records);
        String id=submit("/api/import/jobs",Map.of("requestId","preview-1","request",request)).path("id").asText();waitFor(id);
        JsonNode result=mapper.valueToTree(runner.result(id));assertEquals(1,result.path("added").asInt());assertEquals(1,result.path("skipped").asInt());
        assertEquals("customerName",result.path("details").get(1).path("issues").get(0).path("field").asText());
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$.data.totalElements").value(0));
        id=submit("/api/import/jobs",Map.of("requestId","write-1","request",Map.of("dryRun",false,"records",List.of(records.get(0),records.get(0))))).path("id").asText();waitFor(id);
        result=mapper.valueToTree(runner.result(id));assertEquals(1,result.path("added").asInt());assertEquals(1,result.path("skipped").asInt());
        mvc.perform(get("/api/jobs/"+id)).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(2));
        mvc.perform(get("/api/jobs/"+id+"/items")).andExpect(jsonPath("$.data.items.length()").value(2));
    }
    @Test void restartMarksUnfinishedAndRetryPreservesCommittedItems() throws Exception {
        long a=project("A"),b=project("B");var job=store.submit("interrupted","PROJECT_DELETE",List.of(a,b),"任务测试");
        store.initialize(job.id,List.of(a,b),null);worker.execute(job.id,store.results(job.id).get(0).id,Set.of());
        store.interruptUnfinished();assertEquals("INTERRUPTED",store.get(job.id).status);
        runner.retry(job.id,"resume-1");waitFor(job.id);assertEquals("SUCCEEDED",store.get(job.id).status);
        mvc.perform(get("/api/projects").param("deleted","true")).andExpect(jsonPath("$.data.totalElements").value(2));
        assertEquals(2,store.get(job.id).succeeded);
    }
    @Test void concurrentImportJobsCannotCreateDuplicateProjectIdentities() throws Exception {
        var request=Map.of("dryRun",false,"records",List.of(Map.of("fields",Map.of("customerName","并发客户","projectName","同一机会"),"revenues",List.of(),"progress",List.of())));
        String first=submit("/api/import/jobs",Map.of("requestId","parallel-1","request",request)).path("id").asText();
        String second=submit("/api/import/jobs",Map.of("requestId","parallel-2","request",request)).path("id").asText();
        waitFor(first);waitFor(second);assertEquals("SUCCEEDED",store.get(first).status);assertEquals("SUCCEEDED",store.get(second).status);
        mvc.perform(get("/api/projects")).andExpect(jsonPath("$.data.totalElements").value(1));
    }
    private long project(String name)throws Exception{return submit("/api/projects",Map.of("customerName","任务客户","projectName",name,"customFields",Map.of())).path("id").asLong();}
    private JsonNode submit(String path,Object data)throws Exception{return mapper.readTree(mvc.perform(post(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(data))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
    private void waitFor(String id)throws Exception{for(int n=0;n<500;n++){if(!List.of("QUEUED","RUNNING").contains(store.get(id).status))return;Thread.sleep(10);}fail("任务超时");}
}
