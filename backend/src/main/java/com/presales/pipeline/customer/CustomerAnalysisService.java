package com.presales.pipeline.customer;

import com.presales.pipeline.customer.dto.CustomerAnalysisResponse;
import com.presales.pipeline.customer.dto.CustomerProjectResponse;
import com.presales.pipeline.product.ProductCatalog;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.project.ProjectService;
import com.presales.pipeline.revenue.Revenue;
import com.presales.pipeline.revenue.RevenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class CustomerAnalysisService {

    private final ProjectRepository projectRepository;
    private final RevenueRepository revenueRepository;

    public CustomerAnalysisService(ProjectRepository projectRepository, RevenueRepository revenueRepository) {
        this.projectRepository = projectRepository;
        this.revenueRepository = revenueRepository;
    }

    @Transactional(readOnly = true)
    public List<CustomerAnalysisResponse> list(String keyword) {
        List<Project> projects = projectRepository.findAllByDeletedFalseOrderByIdAsc();
        Map<Long, BigDecimal> revenueTotals = revenueTotals(projects);
        String normalizedKeyword = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);

        Map<String, CustomerAccumulator> customers = new LinkedHashMap<>();
        for (Project project : projects) {
            String customerKey = project.getCustomerName().toLowerCase(Locale.ROOT);
            customers.computeIfAbsent(customerKey, ignored -> new CustomerAccumulator(project.getCustomerName()))
                    .add(project, revenueTotals.getOrDefault(project.getId(), BigDecimal.ZERO));
        }

        return customers.values().stream()
                .map(CustomerAccumulator::toResponse)
                .filter(customer -> matches(customer, normalizedKeyword))
                .sorted(Comparator.comparing(CustomerAnalysisResponse::revenueTotal).reversed()
                        .thenComparing(CustomerAnalysisResponse::customerName))
                .toList();
    }

    private Map<Long, BigDecimal> revenueTotals(List<Project> projects) {
        List<Long> projectIds = projects.stream().map(Project::getId).toList();
        if (projectIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, BigDecimal> totals = new HashMap<>();
        for (Revenue revenue : revenueRepository.findAllByProjectIdInAndDeletedFalse(projectIds)) {
            totals.merge(revenue.getProject().getId(), revenue.getAmount(), BigDecimal::add);
        }
        return totals;
    }

    private boolean matches(CustomerAnalysisResponse customer, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        if (customer.customerName().toLowerCase(Locale.ROOT).contains(keyword)) {
            return true;
        }
        if (customer.purchasedProducts().stream().anyMatch(product -> product.toLowerCase(Locale.ROOT).contains(keyword))) {
            return true;
        }
        return customer.projects().stream().anyMatch(project ->
                project.projectName().toLowerCase(Locale.ROOT).contains(keyword)
                        || (project.externalId() != null && project.externalId().toLowerCase(Locale.ROOT).contains(keyword)));
    }

    private static final class CustomerAccumulator {
        private final String customerName;
        private final List<CustomerProjectResponse> projects = new ArrayList<>();
        private final Map<String, Integer> statusCounts = new LinkedHashMap<>();
        private final LinkedHashSet<String> products = new LinkedHashSet<>();
        private BigDecimal revenueTotal = BigDecimal.ZERO;
        private java.time.LocalDateTime updatedAt;

        private CustomerAccumulator(String customerName) {
            this.customerName = customerName;
            ProjectService.PROJECT_STATUSES.forEach(status -> statusCounts.put(status, 0));
        }

        private void add(Project project, BigDecimal projectRevenue) {
            statusCounts.merge(project.getProjectStatus(), 1, Integer::sum);
            products.addAll(project.getPurchasedProducts());
            revenueTotal = revenueTotal.add(projectRevenue);
            if (updatedAt == null || project.getUpdatedAt().isAfter(updatedAt)) {
                updatedAt = project.getUpdatedAt();
            }
            projects.add(new CustomerProjectResponse(
                    project.getId(), project.getExternalId(), project.getProjectName(), project.getProjectStatus(),
                    project.getIndustry(), project.getTrack(), project.getSolution(), project.getSubSolution(),
                    project.getPurchasedProducts(), projectRevenue, project.getUpdatedAt()));
        }

        private CustomerAnalysisResponse toResponse() {
            List<String> orderedProducts = ProductCatalog.CODES.stream().filter(products::contains).toList();
            List<CustomerProjectResponse> orderedProjects = projects.stream()
                    .sorted(Comparator.comparing(CustomerProjectResponse::updatedAt).reversed())
                    .toList();
            return new CustomerAnalysisResponse(customerName, projects.size(),
                    statusCounts.getOrDefault(ProjectService.WON_STATUS, 0), Map.copyOf(statusCounts),
                    orderedProducts, revenueTotal, updatedAt, orderedProjects);
        }
    }
}
