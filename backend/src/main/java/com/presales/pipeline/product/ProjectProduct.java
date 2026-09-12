package com.presales.pipeline.product;

import com.presales.pipeline.common.model.BaseEntity;
import com.presales.pipeline.project.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "project_products", uniqueConstraints = {
        @UniqueConstraint(name = "uk_project_products_project_code", columnNames = {"project_id", "product_code"})
})
public class ProjectProduct extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "product_code", nullable = false, length = 32)
    private String productCode;

    protected ProjectProduct() {
    }

    public ProjectProduct(Project project, String productCode) {
        this.project = project;
        this.productCode = productCode;
    }

    public Project getProject() {
        return project;
    }

    public String getProductCode() {
        return productCode;
    }
}
