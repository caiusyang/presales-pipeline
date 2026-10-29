package com.presales.pipeline.project.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;

public record ProjectResponse(
        Long id,
        String externalId,
        String customerName,
        String projectName,
        String projectStatus,
        BigDecimal securityBudget,
        String solution,
        String subSolution,
        List<String> purchasedProducts,
        String track,
        String industry,
        String subIndustry,
        String scenario,
        String keyRisks,
        String keyNeeds,
        Map<String, Object> customFields,
        BigDecimal revenueTotal,
        boolean deleted,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime lastFollowUpAt,
        java.time.LocalDate nextActionDate,
        String nextActionNote,
        String securityDirection,
        List<com.presales.pipeline.solution.SolutionSelection> solutions,
        String hcsOpportunityId,String hcsStatus,LocalDateTime lastSyncAt,
        List<Long> responsibleIds,List<com.presales.pipeline.project.Project.Responsible> responsibles,
        boolean fixedTarget,String projectLevel
) {
}
