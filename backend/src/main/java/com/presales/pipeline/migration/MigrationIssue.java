package com.presales.pipeline.migration;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="migration_issues")
public class MigrationIssue {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @Column(name="project_id") public Long projectId;
    @Column(nullable=false,length=64) public String area;
    @Column(nullable=false,columnDefinition="text") public String reason;
    @Column(name="original_value",columnDefinition="text") public String originalValue;
    public boolean resolved;
    @Column(name="created_at",nullable=false) public LocalDateTime createdAt;
}
