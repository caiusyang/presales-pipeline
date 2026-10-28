package com.presales.pipeline.solution;
import com.presales.pipeline.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.*;
@RestController @RequestMapping("/api/stats/solutions")
public class SolutionStatsController {
    @PersistenceContext private EntityManager em;
    @GetMapping @Transactional(readOnly=true) public ApiResponse<Map<String,Object>> stats(){
        String from=" from ProjectSolution s join s.project p where p.deleted=false ";
        List<Object[]> parents=em.createQuery("select s.solution.id,s.solution.value,count(distinct p.id),count(distinct lower(p.customerName))"+from+"group by s.solution.id,s.solution.value",Object[].class).getResultList();
        List<Object[]> statuses=em.createQuery("select s.solution.id,p.projectStatus,count(distinct p.id)"+from+"group by s.solution.id,p.projectStatus",Object[].class).getResultList();
        List<Object[]> children=em.createQuery("select s.solution.id,s.subSolution.id,s.subSolution.value,count(distinct p.id),count(distinct lower(p.customerName))"+from+"and s.subSolution is not null group by s.solution.id,s.subSolution.id,s.subSolution.value",Object[].class).getResultList();
        List<Map<String,Object>> items=new ArrayList<>();
        long coverage=0;
        for(var row:parents){Map<String,Long> counts=new LinkedHashMap<>();for(var status:statuses)if(Objects.equals(row[0],status[0]))counts.put(String.valueOf(status[1]),((Number)status[2]).longValue());
            List<Map<String,Object>> subs=new ArrayList<>();for(var child:children)if(Objects.equals(row[0],child[0]))subs.add(Map.of("id",child[1],"name",child[2],"projectCount",child[3],"customerCount",child[4]));
            var item=new LinkedHashMap<String,Object>();item.put("id",row[0]);item.put("solution",row[1]);item.put("projectCount",row[2]);item.put("customerCount",row[3]);item.put("wonProjectCount",counts.getOrDefault("中标",0L));item.put("statusCounts",counts);item.put("subSolutions",subs);items.add(item);coverage+=((Number)row[2]).longValue();
        }
        long total=em.createQuery("select count(p) from Project p where p.deleted=false",Long.class).getSingleResult();
        long covered=em.createQuery("select count(distinct s.project.id) from ProjectSolution s where s.project.deleted=false",Long.class).getSingleResult();
        return ApiResponse.success(Map.of("totalProjectCount",total,"coveredProjectCount",covered,"solutionCoverageCount",coverage,"items",items,"notice","方案覆盖数可能大于项目总数；一级方案、细分方案内分别按项目去重；不分摊收入"));
    }
}
