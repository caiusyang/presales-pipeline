package com.presales.pipeline.progress;

import com.presales.pipeline.common.model.SoftDeletableEntity;
import com.presales.pipeline.project.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "progress_logs")
public class ProgressLog extends SoftDeletableEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    protected ProgressLog() {
    }

    public ProgressLog(Project project, LocalDate logDate, String content) {
        this.project = project;
        this.logDate = logDate;
        this.content = content;
    }

    public Project getProject() {
        return project;
    }

    public LocalDate getLogDate() {
        return logDate;
    }

    public void setLogDate(LocalDate logDate) {
        this.logDate = logDate;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
