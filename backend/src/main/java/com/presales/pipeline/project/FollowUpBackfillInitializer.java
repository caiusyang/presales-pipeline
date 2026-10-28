package com.presales.pipeline.project;
import org.springframework.boot.*;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
/** Mirrors V8 for the local H2 profile without turning upgrade time into a business follow-up. */
@Component @Order(5)
public class FollowUpBackfillInitializer implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public FollowUpBackfillInitializer(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @Override public void run(ApplicationArguments args){jdbc.update("""
      UPDATE projects p SET last_follow_up_at=GREATEST(
       p.created_at,
       COALESCE((SELECT MAX(c.created_at) FROM change_logs c WHERE c.project_id=p.id AND c.field NOT IN ('deleted','lastSyncAt')),p.created_at),
       COALESCE((SELECT MAX(g.updated_at) FROM progress_logs g WHERE g.project_id=p.id),p.created_at),
       COALESCE((SELECT MAX(r.updated_at) FROM revenues r WHERE r.project_id=p.id),p.created_at),
       COALESCE((SELECT MAX(x.updated_at) FROM project_products x WHERE x.project_id=p.id),p.created_at))
       WHERE p.last_follow_up_at IS NULL
      """);}
}
