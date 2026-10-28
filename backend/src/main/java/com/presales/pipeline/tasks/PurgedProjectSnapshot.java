package com.presales.pipeline.tasks;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.*;
/** Only irreversible identity hashes and technical IDs remain, never project/customer names or content. */
@Entity @Table(name="purged_project_snapshots")
public class PurgedProjectSnapshot {
    @Id @Column(name="project_id") public Long projectId;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="identity_hashes",nullable=false,columnDefinition="json") public List<String> identityHashes=new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="progress_ids",nullable=false,columnDefinition="json") public List<Long> progressIds=new ArrayList<>();
    @Column(name="purged_at",nullable=false) public LocalDateTime purgedAt;
}
