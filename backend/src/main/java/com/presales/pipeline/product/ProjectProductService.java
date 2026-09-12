package com.presales.pipeline.product;

import com.presales.pipeline.product.dto.ProjectProductResponse;
import com.presales.pipeline.project.Project;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ProjectProductService {

    private final ProjectProductRepository repository;

    public ProjectProductService(ProjectProductRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ProjectProductResponse> list(Long projectId) {
        Map<String, Integer> order = new HashMap<>();
        for (int index = 0; index < ProductCatalog.CODES.size(); index++) {
            order.put(ProductCatalog.CODES.get(index), index);
        }
        return repository.findAllByProjectIdOrderByIdAsc(projectId).stream()
                .sorted((left, right) -> Integer.compare(
                        order.getOrDefault(left.getProductCode(), Integer.MAX_VALUE),
                        order.getOrDefault(right.getProductCode(), Integer.MAX_VALUE)))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void sync(Project project, List<String> productCodes) {
        List<String> normalized = ProductCatalog.normalizeAll(productCodes);
        Set<String> desired = Set.copyOf(normalized);
        List<ProjectProduct> existing = repository.findAllByProjectIdOrderByIdAsc(project.getId());

        List<ProjectProduct> removed = existing.stream()
                .filter(record -> !desired.contains(record.getProductCode()))
                .toList();
        if (!removed.isEmpty()) {
            repository.deleteAll(removed);
        }

        Set<String> present = existing.stream()
                .map(ProjectProduct::getProductCode)
                .filter(desired::contains)
                .collect(java.util.stream.Collectors.toSet());
        for (String productCode : normalized) {
            if (!present.contains(productCode)) {
                repository.save(new ProjectProduct(project, productCode));
            }
        }
    }

    private ProjectProductResponse toResponse(ProjectProduct record) {
        return new ProjectProductResponse(record.getId(), record.getProject().getId(), record.getProductCode(),
                record.getCreatedAt(), record.getUpdatedAt());
    }
}
