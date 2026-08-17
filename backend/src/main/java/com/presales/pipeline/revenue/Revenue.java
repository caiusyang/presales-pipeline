package com.presales.pipeline.revenue;

import com.presales.pipeline.common.model.SoftDeletableEntity;
import com.presales.pipeline.project.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "revenues")
public class Revenue extends SoftDeletableEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "revenue_month", nullable = false, length = 7)
    private String month;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    protected Revenue() {
    }

    public Revenue(Project project, String month, BigDecimal amount) {
        this.project = project;
        this.month = month;
        this.amount = amount;
    }

    public Project getProject() {
        return project;
    }

    public String getMonth() {
        return month;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
