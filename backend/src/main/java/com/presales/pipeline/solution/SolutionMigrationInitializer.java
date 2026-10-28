package com.presales.pipeline.solution;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.migration.*;
import org.springframework.boot.*;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.transaction.annotation.Transactional;
@Component @Order(20)
public class SolutionMigrationInitializer implements ApplicationRunner {
    private final ProjectRepository projects;private final ProjectSolutions solutions;private final MigrationIssueRepository issues;
    public SolutionMigrationInitializer(ProjectRepository projects,ProjectSolutions solutions,MigrationIssueRepository issues){this.projects=projects;this.solutions=solutions;this.issues=issues;}
    @Override @Transactional public void run(ApplicationArguments args){
        for(var p:projects.findAll()){
            if(!p.solutionLinks().isEmpty()||p.getSolutions().isEmpty()&&p.getSubSolution()==null)continue;
            try{solutions.sync(p,solutions.normalize(null,p.getSolution(),p.getSubSolution()));}
            catch(com.presales.pipeline.common.exception.BusinessException error){if(issues.findByProjectIdAndArea(p.getId(),"solutions").isEmpty()){var issue=new MigrationIssue();issue.projectId=p.getId();issue.area="solutions";issue.reason=error.getMessage();issue.originalValue=String.valueOf(p.getSolution())+" / "+String.valueOf(p.getSubSolution());issue.createdAt=java.time.LocalDateTime.now(com.presales.pipeline.common.config.BusinessTime.ZONE);issues.save(issue);}}
        }
    }
}
