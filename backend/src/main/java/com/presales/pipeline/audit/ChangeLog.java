package com.presales.pipeline.audit;

import com.presales.pipeline.common.model.BaseEntity;
import com.presales.pipeline.project.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "change_logs")
public class ChangeLog extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false)
    private String operator;

    @Column(nullable = false, length = 128)
    private String field;

    @Column(name = "old_value", columnDefinition = "text")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "text")
    private String newValue;

    @Column(nullable = false, length = 32)
    private String source;

    protected ChangeLog() {
    }

    public ChangeLog(Project project, String operator, String field, String oldValue, String newValue, String source) {
        this.project = project;
        this.operator = operator;
        this.field = field;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.source = source;
    }

    public Project getProject() {
        return project;
    }

    public String getOperator() {
        return operator;
    }

    public String getField() {
        return field;
    }

    public String getOldValue() {
        return oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public String getSource() {
        return source;
    }
}
