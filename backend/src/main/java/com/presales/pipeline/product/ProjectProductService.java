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
    private final ProductCatalog catalog;

    public ProjectProductService(ProjectProductRepository repository,ProductCatalog catalog) {
        this.catalog=catalog;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ProjectProductResponse> list(Long projectId) {
        Map<String, Integer> order = new HashMap<>();
        var codes=catalog.codes();
        for (int index = 0; index < codes.size(); index++) {
            order.put(codes.get(index), index);
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
        List<String> normalized = catalog.normalizeAll(productCodes);
        Set<String> desired = Set.copyOf(normalized);
        List<com.presales.pipeline.importing.ImportBatchLookup.Owned> existing=com.presales.pipeline.importing.ImportBatchLookup.fresh(project)?com.presales.pipeline.importing.ImportBatchLookup.current().products().getOrDefault(project.getId(),List.of()):repository.findAllByProjectIdOrderByIdAsc(project.getId()).stream().map(p->new com.presales.pipeline.importing.ImportBatchLookup.Owned(p.getId(),p.getProductCode())).toList();

        var removed = existing.stream()
                .filter(record -> !desired.contains(record.code()))
                .toList();
        if (!removed.isEmpty()) {
            repository.deleteAllByIdInBatch(removed.stream().map(com.presales.pipeline.importing.ImportBatchLookup.Owned::id).toList());
        }

        Set<String> present = existing.stream()
                .map(com.presales.pipeline.importing.ImportBatchLookup.Owned::code)
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
