package com.presales.pipeline;
import com.fasterxml.jackson.databind.*;
import com.presales.pipeline.people.*;
import com.presales.pipeline.project.*;
import com.presales.pipeline.tasks.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc @WithMockUser(roles="ADMIN") @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class PeopleIntegrationTest {
    @Autowired MockMvc mvc;@Autowired ObjectMapper mapper;@Autowired PeopleService people;@Autowired ProjectRepository projects;@Autowired PlatformTransactionManager manager;@Autowired JobStore jobs;
    private long person(String name,String employee,String alias){return people.save(null,new PeopleService.Input(name,employee,null,List.of(alias),true)).getId();}
    @Test void exactMatchingKeepsAllUniqueHitsAndNeverGuessesAmbiguousNames(){
        long a=person("王明","001","小王甲"),b=person("王明","002","小王乙"),c=person("张林","003","老张");
        var match=people.match(List.of(new PeopleService.Reference("王明",null,null,null),new PeopleService.Reference("小王甲",null,null,null),new PeopleService.Reference("张林","003",null,null),new PeopleService.Reference("王明","002",null,null),new PeopleService.Reference("未知",null,null,null)));
        assertEquals(Set.of(a,b,c),Set.copyOf(match.personIds()));assertEquals(2,match.issues().size());
        assertTrue(people.match(List.of(new PeopleService.Reference("张林","missing",null,null))).personIds().isEmpty());
    }
    @Test void manualAndHcsSourcesRemainIndependentAndIncompleteHcsListsNeverClear()throws Exception{
        long a=person("手工人","100","手工别名"),b=person("HCS甲","200","甲别名"),c=person("HCS乙","300","乙别名");
        var input=new LinkedHashMap<String,Object>(Map.of("customerName","责任人客户","projectName","来源隔离","customFields",Map.of(),"responsibleIds",List.of(a),"hcsOpportunityId","HCS-EXPLICIT-1"));
        var created=mapper.readTree(mvc.perform(post("/api/projects").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data");long id=created.path("id").asLong();
        var tx=new TransactionTemplate(manager);tx.executeWithoutResult(status->{var p=projects.findById(id).orElseThrow();people.applyHcs(p,List.of(new PeopleService.Reference(null,"200",null,"一线SA"),new PeopleService.Reference(null,"300",null,"专家")),true);});
        tx.executeWithoutResult(status->{var p=projects.findById(id).orElseThrow();assertEquals(3,p.getResponsibles().size());var follow=p.getLastFollowUpAt();people.applyHcs(p,List.of(new PeopleService.Reference(null,"200",null,"一线SA"),new PeopleService.Reference(null,"300",null,"专家")),true);assertEquals(follow,p.getLastFollowUpAt());people.applyHcs(p,List.of(),false);assertEquals(3,p.getResponsibles().size());people.applyHcs(p,List.of(new PeopleService.Reference(null,"200",null,"一线SA")),true);assertEquals(Set.of(a,b),p.getResponsibles().stream().map(Project.Responsible::personId).collect(java.util.stream.Collectors.toSet()));assertEquals("一线SA",p.getResponsibles().stream().filter(r->r.personId().equals(b)).findFirst().orElseThrow().role());});
        mvc.perform(get("/api/projects").param("responsibleId",String.valueOf(b))).andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        input.put("hcsStatus","客户端不应写入");mvc.perform(put("/api/projects/"+id).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input))).andExpect(status().isOk()).andExpect(jsonPath("$.data.hcsStatus").isEmpty()).andExpect(jsonPath("$.data.responsibles.length()").value(2));
    }
    @Test void peopleImportIsPersistentAndFailureIsPerItem()throws Exception{
        var body=Map.of("requestId","people-import-test","people",List.of(Map.of("name","库导入甲","employeeNo","P-1","aliases",List.of("甲"),"enabled",true),Map.of("name","","employeeNo","P-2","aliases",List.of(),"enabled",true)));
        var job=mapper.readTree(mvc.perform(post("/api/config/people/import").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body))).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data");String id=job.path("id").asText();
        for(int i=0;i<500&&List.of("QUEUED","RUNNING").contains(jobs.get(id).status);i++)Thread.sleep(10);
        assertEquals("PARTIAL",jobs.get(id).status);assertEquals(1,jobs.get(id).succeeded);assertEquals(1,jobs.get(id).failed);
        mvc.perform(get("/api/jobs/"+id+"/result")).andExpect(status().isOk()).andExpect(jsonPath("$.data.details.length()").value(2));
        mvc.perform(get("/api/backup")).andExpect(jsonPath("$.data.tables.responsible_people.length()").value(1)).andExpect(jsonPath("$.data.tables.project_responsibles").isArray());
    }
}
