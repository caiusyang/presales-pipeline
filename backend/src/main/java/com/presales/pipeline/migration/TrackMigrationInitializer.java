package com.presales.pipeline.migration;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.dictionary.DictionaryRepository;
import org.springframework.boot.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.core.annotation.Order;
import java.util.List;

/** Mirrors the Flyway data conversion for local H2 ddl-auto test/development databases. */
@Component @Order(10)
public class TrackMigrationInitializer implements ApplicationRunner {
    private final ProjectRepository projects;private final DictionaryRepository dictionaries;private final MigrationIssueRepository issues;
    public TrackMigrationInitializer(ProjectRepository projects,DictionaryRepository dictionaries,MigrationIssueRepository issues){this.projects=projects;this.dictionaries=dictionaries;this.issues=issues;}
    @Override @Transactional public void run(ApplicationArguments args){
        projects.findAll().forEach(p->{String track=p.getTrack();if(track!=null&&!track.isBlank()&&!List.of("HCS","公有云").contains(track)){
            if(p.getSecurityDirection()==null)p.setSecurityDirection(track);
            if(issues.findByProjectIdAndArea(p.getId(),"track").isEmpty()){var issue=new MigrationIssue();issue.projectId=p.getId();issue.area="track";issue.reason="旧值是安全方向，无法据此判断 HCS/公有云；请人工分类";issue.originalValue=track;issue.createdAt=java.time.LocalDateTime.now(com.presales.pipeline.common.config.BusinessTime.ZONE);issues.save(issue);}
            p.setTrack(null);
        }});
        dictionaries.findAll().forEach(d->{if(d.getType().equals("track")&&!List.of("HCS","公有云").contains(d.getValue()))d.setType("security_direction");});
    }
}
