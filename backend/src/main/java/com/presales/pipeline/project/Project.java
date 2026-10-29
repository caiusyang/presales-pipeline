package com.presales.pipeline.project;

import com.presales.pipeline.common.model.SoftDeletableEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "projects")
public class Project extends SoftDeletableEntity {
    @jakarta.persistence.Version @Column(name="row_version",nullable=false,columnDefinition="bigint default 0") private long rowVersion;
    public long getRowVersion(){return rowVersion;}
    @Column(name="fixed_target",nullable=false,columnDefinition="boolean default false") private boolean fixedTarget;
    @Column(name="project_level",length=16) private String projectLevel;
    public boolean isFixedTarget(){return fixedTarget;}
    public void setFixedTarget(boolean value){fixedTarget=value;}
    public String getProjectLevel(){return projectLevel;}
    public void setProjectLevel(String value){projectLevel=value;}
    @Column(name="hcs_opportunity_id",unique=true,length=128) private String hcsOpportunityId;
    @Column(name="hcs_status") private String hcsStatus;
    @Column(name="last_sync_at") private java.time.LocalDateTime lastSyncAt;
    public String getHcsOpportunityId(){return hcsOpportunityId;}
    public void setHcsOpportunityId(String value){hcsOpportunityId=value;}
    public String getHcsStatus(){return hcsStatus;}
    public void setHcsStatus(String value){hcsStatus=value;}
    public java.time.LocalDateTime getLastSyncAt(){return lastSyncAt;}
    public void setLastSyncAt(java.time.LocalDateTime value){lastSyncAt=value;}
    @jakarta.persistence.OneToMany(mappedBy="project",cascade=jakarta.persistence.CascadeType.ALL,orphanRemoval=true) @org.hibernate.annotations.BatchSize(size=100) @jakarta.persistence.OrderBy("id ASC")
    private List<com.presales.pipeline.people.ProjectPerson> personLinks=new ArrayList<>();
    public List<com.presales.pipeline.people.ProjectPerson> personLinks(){return personLinks;}
    public List<Long> getResponsibleIds(){return personLinks.stream().filter(r->r.source.equals("manual")).map(r->r.person.getId()).distinct().sorted().toList();}
    public record Responsible(Long personId,String name,String employeeNo,String account,String source,String role){}
    public List<Responsible> getResponsibles(){return personLinks.stream().map(r->new Responsible(r.person.getId(),r.person.getName(),r.person.getEmployeeNo(),r.person.getAccount(),r.source,r.role)).toList();}
    @jakarta.persistence.OneToMany(mappedBy="project",cascade=jakarta.persistence.CascadeType.ALL,orphanRemoval=true)
    @org.hibernate.annotations.BatchSize(size=100)
    @jakarta.persistence.OrderBy("id ASC")
    private List<com.presales.pipeline.solution.ProjectSolution> solutionLinks=new ArrayList<>();
    public List<com.presales.pipeline.solution.ProjectSolution> solutionLinks(){return solutionLinks;}
    public List<com.presales.pipeline.solution.SolutionSelection> getSolutions(){
        Map<String,java.util.Set<String>> grouped=new java.util.TreeMap<>();
        for(var link:solutionLinks){var children=grouped.computeIfAbsent(link.solution.getValue(),key->new java.util.TreeSet<>());if(link.subSolution!=null)children.add(link.subSolution.getValue());}
        if(grouped.isEmpty()&&solution!=null&&!solution.isBlank())grouped.put(solution,subSolution==null||subSolution.isBlank()?java.util.Set.of():java.util.Set.of(subSolution));
        return grouped.entrySet().stream().map(e->new com.presales.pipeline.solution.SolutionSelection(e.getKey(),List.copyOf(e.getValue()))).toList();
    }
    @Column(name="last_follow_up_at") private java.time.LocalDateTime lastFollowUpAt;
    @Column(name="next_action_date") private java.time.LocalDate nextActionDate;
    @Column(name="next_action_note",columnDefinition="text") private String nextActionNote;
    public java.time.LocalDateTime getLastFollowUpAt(){return lastFollowUpAt;}
    public void touchFollowUp(){lastFollowUpAt=com.presales.pipeline.common.config.BusinessTime.now();}
    public java.time.LocalDate getNextActionDate(){return nextActionDate;}
    public void setNextActionDate(java.time.LocalDate value){nextActionDate=value;}
    public String getNextActionNote(){return nextActionNote;}
    public void setNextActionNote(String value){nextActionNote=value;}

    @Column(name = "external_id", length = 128, unique = true)
    private String externalId;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "project_name", nullable = false)
    private String projectName;

    @Column(name = "project_status", length = 32)
    private String projectStatus = "机会点识别";

    @Column(name = "security_budget", precision = 18, scale = 2)
    private BigDecimal securityBudget;

    private String solution;

    @Column(name = "sub_solution")
    private String subSolution;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "purchased_products", columnDefinition = "json")
    private List<String> purchasedProducts = new ArrayList<>();

    private String track;
    @Column(name="security_direction") private String securityDirection;
    public String getSecurityDirection(){return securityDirection;}
    public void setSecurityDirection(String value){securityDirection=value;}

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

    public String getProjectStatus() {
        return projectStatus == null ? "机会点识别" : projectStatus;
    }

    public void setProjectStatus(String projectStatus) {
        this.projectStatus = projectStatus;
    }

    public BigDecimal getSecurityBudget() {
        return securityBudget;
    }

    public void setSecurityBudget(BigDecimal securityBudget) {
        this.securityBudget = securityBudget;
    }

    public String getSolution() {
        return solution;
    }

    public void setSolution(String solution) {
        this.solution = solution;
    }

    public String getSubSolution() {
        return subSolution;
    }

    public void setSubSolution(String subSolution) {
        this.subSolution = subSolution;
    }

    public List<String> getPurchasedProducts() {
        return purchasedProducts == null ? List.of() : purchasedProducts;
    }

    public void setPurchasedProducts(List<String> purchasedProducts) {
        this.purchasedProducts = purchasedProducts == null ? new ArrayList<>() : new ArrayList<>(purchasedProducts);
    }

    boolean initializeLegacyDefaults() {
        boolean changed = false;
        if (projectStatus == null) {
            projectStatus = "机会点识别";
            changed = true;
        }
        if (purchasedProducts == null) {
            purchasedProducts = new ArrayList<>();
            changed = true;
        }
        return changed;
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
