package com.presales.pipeline;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Opt-in isolated H2 comparison, not a substitute for the specified MySQL acceptance host. */
@SpringBootTest(properties = {"app.security.enabled=false", "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.stat=ERROR", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=ERROR"})
@AutoConfigureMockMvc
@DirtiesContext
@EnabledIfSystemProperty(named = "benchmark", matches = "true")
class PerformanceBaselineTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired EntityManagerFactory emf;
    @Autowired ObjectMapper mapper;
    @Autowired com.presales.pipeline.tasks.JobStore jobs;

    @Test void measure() throws Exception {
        jdbc.execute("insert into projects(id,external_id,customer_name,project_name,project_status,track,custom_fields,purchased_products,deleted,created_at,updated_at) "
                + "select n,'BENCH-'||n,'基准客户'||n,'基准项目'||n,'机会点识别','', '{}' FORMAT JSON, '[]' FORMAT JSON,false,TIMESTAMP '2025-01-01 00:00:00',TIMESTAMP '2025-01-01 00:00:00' from system_range(1,10000) p(n)");
        jdbc.execute("alter table projects alter column id restart with 10001");
        jdbc.execute("insert into revenues(project_id,revenue_month,amount,deleted,created_at,updated_at) select p.n,'2025-'||lpad(cast(m.n as varchar),2,'0'),10,false,current_timestamp,current_timestamp from system_range(1,10000) p(n) cross join system_range(1,12) m(n)");
        jdbc.execute("insert into progress_logs(project_id,log_date,content,deleted,created_at,updated_at) select p.n,DATE '2025-09-01','基准进展'||m.n,false,current_timestamp,current_timestamp from system_range(1,10000) p(n) cross join system_range(1,10) m(n)");
        var statistics = emf.unwrap(SessionFactory.class).getStatistics();
        Map<String,Object> report = new LinkedHashMap<>();
        report.put("baseline", System.getProperty("benchmark.label", "before"));
        report.put("database", "isolated H2 / MySQL mode; not formal acceptance");
        report.put("dataset", Map.of("projects",10000,"revenues",120000,"progress",100000));
        for (String name : List.of("list", "preflight", "write", "export", "delete")) {
            statistics.clear(); long started = System.nanoTime();
            if (name.equals("list")) {
                List<Double> times = new ArrayList<>();
                for (int i=0;i<30;i++) { long a=System.nanoTime(); mvc.perform(get("/api/projects").param("page",String.valueOf(i)).param("size","100")).andExpect(status().isOk()); times.add((System.nanoTime()-a)/1e6); }
                Collections.sort(times); report.put("listP95Ms",times.get(28));
            } else if (name.equals("export")) {
                mvc.perform(post("/api/export").contentType(MediaType.APPLICATION_JSON).content("{\"scope\":\"combined\",\"columns\":[{\"key\":\"projectName\",\"title\":\"项目\"},{\"key\":\"revenueTotal\",\"title\":\"收入\"},{\"key\":\"progressSummary\",\"title\":\"进展\"}]}"))
                        .andExpect(status().isOk());
            } else if (name.equals("delete")) {
                for (int i=1;i<=1000;i++) mvc.perform(delete("/api/projects/"+i)).andExpect(status().isOk());
            } else {
                List<Map<String,Object>> records = new ArrayList<>();
                for (int i=1;i<=1000;i++) records.add(Map.of("sourceRow",i+1,"fields",Map.of("externalId","BENCH-"+i,"customerName","基准客户"+i,"projectName","基准项目"+i,"keyNeeds","导入基准"),"revenues",List.of(),"progress",List.of()));
                mvc.perform(post("/api/import").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(Map.of("dryRun",name.equals("preflight"),"records",records)))).andExpect(status().isOk());
            }
            report.put(name,Map.of("elapsedMs",(System.nanoTime()-started)/1e6,"databaseStatements",statistics.getPrepareStatementCount(),"httpRequests",name.equals("list")?30:name.equals("delete")?1000:1));
        }
        if(Boolean.getBoolean("benchmark.async")) {
            jdbc.update("update projects set deleted=false where id<=1000");
            for(String operation:List.of("preflight","write","export","delete")){
                statistics.clear();List<Map<String,Object>> records=new ArrayList<>();for(int i=1;i<=1000;i++)records.add(Map.of("sourceRow",i+1,"fields",Map.of("externalId","BENCH-"+i,"customerName","基准客户"+i,"projectName","基准项目"+i,"keyNeeds","后台导入基准"),"revenues",List.of(),"progress",List.of()));
                String path;Map<String,Object> payload=new LinkedHashMap<>();payload.put("requestId","async-bench-"+operation);
                if(operation.equals("delete")){path="/api/projects/batch";payload.put("operation","delete");payload.put("projectIds",java.util.stream.LongStream.rangeClosed(1,1000).boxed().toList());}
                else if(operation.equals("export")){path="/api/export/jobs";payload.put("request",Map.of("scope","combined","columns",List.of(Map.of("key","projectName","title","项目"),Map.of("key","revenueTotal","title","收入"),Map.of("key","progressSummary","title","进展"))));}
                else {path="/api/import/jobs";payload.put("request",Map.of("dryRun",operation.equals("preflight"),"records",records));}
                long started=System.nanoTime();var response=mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(payload))).andExpect(status().isOk()).andReturn();double accepted=(System.nanoTime()-started)/1e6;
                String id=mapper.readTree(response.getResponse().getContentAsByteArray()).path("data").path("id").asText();
                for(int attempt=0;attempt<1200&&List.of("QUEUED","RUNNING").contains(jobs.get(id).status);attempt++)Thread.sleep(50);
                var job=jobs.get(id);org.junit.jupiter.api.Assertions.assertEquals("SUCCEEDED",job.status,"后台任务必须全部成功，不能以跳过实现提速："+operation+" / "+job.error);
                report.put("async-"+operation,Map.of("acceptedMs",accepted,"elapsedMs",(System.nanoTime()-started)/1e6,"databaseStatements",statistics.getPrepareStatementCount(),"submitRequests",1,"processed",job.processed,"failed",job.failed));
            }
        }
        Path output = Path.of(System.getProperty("benchmark.output","/tmp/presales-baseline-before.json"));
        Files.writeString(output,mapper.writerWithDefaultPrettyPrinter().writeValueAsString(report));
        System.out.println("BENCHMARK " + output + " " + mapper.writeValueAsString(report));
    }
}
