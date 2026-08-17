package com.presales.pipeline.project;

import com.presales.pipeline.common.model.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "projects")
public class Project extends SoftDeletableEntity {

    @Column(name = "external_id", length = 128, unique = true)
    private String externalId;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "project_name", nullable = false)
    private String projectName;

    @Column(name = "safety_space")
    private String safetySpace;

    private String solution;

    private String track;

    private String industry;

    @Column(name = "sub_industry")
    private String subIndustry;

    @Column(columnDefinition = "text")
    private String scenario;

    @Column(name = "key_risks", columnDefinition = "text")
    private String keyRisks;

    @Column(name = "key_needs", columnDefinition = "text")
    private String keyNeeds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_fields", nullable = false, columnDefinition = "json")
    private Map<String, Object> customFields = new LinkedHashMap<>();

    protected Project() {
    }

    public String getExternalId() {
        return externalId;
    }

    public void setExternalId(String externalId) {
        this.externalId = externalId;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getSafetySpace() {
        return safetySpace;
    }

    public void setSafetySpace(String safetySpace) {
        this.safetySpace = safetySpace;
    }

    public String getSolution() {
        return solution;
    }

    public void setSolution(String solution) {
        this.solution = solution;
    }

    public String getTrack() {
        return track;
    }

    public void setTrack(String track) {
        this.track = track;
    }

    public String getIndustry() {
        return industry;
    }

    public void setIndustry(String industry) {
        this.industry = industry;
    }

    public String getSubIndustry() {
        return subIndustry;
    }

    public void setSubIndustry(String subIndustry) {
        this.subIndustry = subIndustry;
    }

    public String getScenario() {
        return scenario;
    }

    public void setScenario(String scenario) {
        this.scenario = scenario;
    }

    public String getKeyRisks() {
        return keyRisks;
    }

    public void setKeyRisks(String keyRisks) {
        this.keyRisks = keyRisks;
    }

    public String getKeyNeeds() {
        return keyNeeds;
    }

    public void setKeyNeeds(String keyNeeds) {
        this.keyNeeds = keyNeeds;
    }

    public Map<String, Object> getCustomFields() {
        return customFields;
    }

    public void setCustomFields(Map<String, Object> customFields) {
        this.customFields = customFields == null ? new LinkedHashMap<>() : new LinkedHashMap<>(customFields);
    }
}
