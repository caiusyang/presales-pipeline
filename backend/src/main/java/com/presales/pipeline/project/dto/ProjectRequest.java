package com.presales.pipeline.project.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.Map;
import java.util.List;
import com.presales.pipeline.solution.SolutionSelection;
import jakarta.validation.Valid;

public record ProjectRequest(
        @Size(max = 128) String externalId,
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String projectName,
        @Size(max = 32) String projectStatus,
        @DecimalMin(value = "0", message = "客户安全预算不能为负数")
        @Digits(integer = 16, fraction = 2, message = "客户安全预算最多 16 位整数、2 位小数")
        BigDecimal securityBudget,
        @Size(max = 255) String solution,
        @Size(max = 255) String subSolution,
        List<@Size(max = 255) String> purchasedProducts,
        @Size(max = 255) String track,
        @Size(max = 255) String industry,
        @Size(max = 255) String subIndustry,
        @Size(max = 20000) String scenario,
        @Size(max = 20000) String keyRisks,
        @Size(max = 20000) String keyNeeds,
        @NotNull Map<String, Object> customFields,
        java.time.LocalDate nextActionDate,
        @Size(max=20000) String nextActionNote,
        @Size(max=255) String securityDirection,
        @Size(max=100) List<@Valid SolutionSelection> solutions,
        @Size(max=128) String hcsOpportunityId,
        @Size(max=100) List<@jakarta.validation.constraints.Positive Long> responsibleIds,
        Boolean fixedTarget,
        @jakarta.validation.constraints.Pattern(regexp="无风险|低风险|高风险|",message="项目级别只能为无风险、低风险、高风险") String projectLevel
) {
    public ProjectRequest(String externalId,String customerName,String projectName,String projectStatus,BigDecimal securityBudget,String solution,String subSolution,List<String> purchasedProducts,String track,String industry,String subIndustry,String scenario,String keyRisks,String keyNeeds,Map<String,Object> customFields,java.time.LocalDate nextActionDate,String nextActionNote,String securityDirection,List<SolutionSelection> solutions,String hcsOpportunityId,List<Long> responsibleIds){this(externalId,customerName,projectName,projectStatus,securityBudget,solution,subSolution,purchasedProducts,track,industry,subIndustry,scenario,keyRisks,keyNeeds,customFields,nextActionDate,nextActionNote,securityDirection,solutions,hcsOpportunityId,responsibleIds,null,null);}
    public ProjectRequest(String externalId,String customerName,String projectName,String projectStatus,BigDecimal securityBudget,String solution,String subSolution,List<String> purchasedProducts,String track,String industry,String subIndustry,String scenario,String keyRisks,String keyNeeds,Map<String,Object> customFields,java.time.LocalDate nextActionDate,String nextActionNote,String securityDirection,List<SolutionSelection> solutions){this(externalId,customerName,projectName,projectStatus,securityBudget,solution,subSolution,purchasedProducts,track,industry,subIndustry,scenario,keyRisks,keyNeeds,customFields,nextActionDate,nextActionNote,securityDirection,solutions,null,null);}
    public ProjectRequest(String externalId,String customerName,String projectName,String projectStatus,BigDecimal securityBudget,String solution,String subSolution,List<String> purchasedProducts,String track,String industry,String subIndustry,String scenario,String keyRisks,String keyNeeds,Map<String,Object> customFields){this(externalId,customerName,projectName,projectStatus,securityBudget,solution,subSolution,purchasedProducts,track,industry,subIndustry,scenario,keyRisks,keyNeeds,customFields,null,null,null,null);}
    public ProjectRequest(String externalId,String customerName,String projectName,String projectStatus,BigDecimal securityBudget,String solution,String subSolution,List<String> purchasedProducts,String track,String industry,String subIndustry,String scenario,String keyRisks,String keyNeeds,Map<String,Object> customFields,java.time.LocalDate nextActionDate,String nextActionNote,String securityDirection){this(externalId,customerName,projectName,projectStatus,securityBudget,solution,subSolution,purchasedProducts,track,industry,subIndustry,scenario,keyRisks,keyNeeds,customFields,nextActionDate,nextActionNote,securityDirection,null);}
}
