package com.presales.pipeline.dictionary;

import com.presales.pipeline.audit.ChangeLogService;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.dictionary.dto.DictionaryNodeResponse;
import com.presales.pipeline.dictionary.dto.DictionaryRequest;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectRepository;
import com.presales.pipeline.product.ProductCatalog;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class DictionaryService {

    private final DictionaryRepository repository;
    private final ProjectRepository projectRepository;
    private final ChangeLogService changeLogService;

    public DictionaryService(DictionaryRepository repository,
                             ProjectRepository projectRepository,
                             ChangeLogService changeLogService) {
        this.repository = repository;
        this.projectRepository = projectRepository;
        this.changeLogService = changeLogService;
    }

    @Transactional(readOnly = true)
    public List<DictionaryNodeResponse> tree(String requestedType) {
        List<DictionaryItem> all = repository.findAllByDeletedFalseOrderByTypeAscSortOrderAscIdAsc();
        Map<Long, MutableNode> nodes = new LinkedHashMap<>();
        for (DictionaryItem item : all) {
            nodes.put(item.getId(), new MutableNode(item));
        }
        for (DictionaryItem item : all) {
            if (item.getParent() != null) {
                MutableNode parent = nodes.get(item.getParent().getId());
                if (parent != null) {
                    parent.children.add(nodes.get(item.getId()));
                }
            }
        }

        String type = requestedType == null || requestedType.isBlank()
                ? null : requestedType.trim().toLowerCase(Locale.ROOT);
        return all.stream()
                .filter(item -> isRequestedRoot(item, type))
                .map(item -> nodes.get(item.getId()).toResponse())
                .toList();
    }

    @Transactional
    public DictionaryNodeResponse create(DictionaryRequest request) {
        String type = normalizeType(request.type());
        String value = clean(request.value());
        if ("product".equals(type)) {
            value = ProductCatalog.normalize(value);
        }
        DictionaryItem parent = resolveParent(request.parentId(), type, null);
        ensureNoDuplicate(type, value, parent, null);

        DictionaryItem item = new DictionaryItem();
        item.setType(type);
        item.setValue(value);
        item.setParent(parent);
        item.setSortOrder(request.sortOrder());
        return toResponse(repository.save(item));
    }

    @Transactional
    public DictionaryNodeResponse update(Long id, DictionaryRequest request) {
        DictionaryItem item = getActive(id);
        String type = normalizeType(request.type());
        String value = clean(request.value());
        if ("product".equals(type)) {
            value = ProductCatalog.normalize(value);
        }
        DictionaryItem parent = resolveParent(request.parentId(), type, id);
        ensureNoDuplicate(type, value, parent, id);

        boolean referenced = isReferenced(item);
        if (referenced && !item.getType().equals(type)) {
            throw BusinessException.conflict("该字典项已被项目引用，不能修改类型");
        }
        Long oldParentId = item.getParent() == null ? null : item.getParent().getId();
        Long newParentId = parent == null ? null : parent.getId();
        if (referenced && !Objects.equals(oldParentId, newParentId)) {
            throw BusinessException.conflict("该字典项已被项目引用，不能更换上级");
        }
        if ("product".equals(item.getType()) && !item.getValue().equals(value)) {
            throw BusinessException.conflict("固定产品编码不可重命名，请删除后重新关联");
        }
        if (referenced && !item.getValue().equals(value)) {
            cascadeProjectValue(item, value);
        }

        item.setType(type);
        item.setValue(value);
        item.setParent(parent);
        item.setSortOrder(request.sortOrder());
        return toResponse(item);
    }

    @Transactional
    public void delete(Long id) {
        DictionaryItem item = getActive(id);
        if (repository.existsByParentIdAndDeletedFalse(id)) {
            throw BusinessException.conflict("该字典项仍有下级项，不能删除");
        }
        if (isReferenced(item)) {
            throw BusinessException.conflict("该字典项已被项目引用，不能删除");
        }
        item.setDeleted(true);
    }

    @Transactional
    public DictionaryNodeResponse restore(Long id) {
        DictionaryItem item = repository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("字典项不存在"));
        if (!item.isDeleted()) {
            return toResponse(item);
        }
        if (item.getParent() != null && item.getParent().isDeleted()) {
            throw BusinessException.conflict("请先恢复该字典项的上级项");
        }
        ensureNoDuplicate(item.getType(), item.getValue(), item.getParent(), id);
        item.setDeleted(false);
        return toResponse(item);
    }

    @Transactional(readOnly = true)
    public void validateProjectSelections(String safetySpace, String solution, String subSolution,
                                          List<String> purchasedProducts, String track,
                                          String industry, String subIndustry) {
        validateIfConfigured("safety_space", safetySpace);
        DictionaryItem solutionItem = validateIfConfigured("solution", solution);
        DictionaryItem subSolutionItem = validateChildIfConfigured(
                "sub_solution", subSolution, solutionItem, "细分解决方案不属于所选解决方案");
        for (String product : purchasedProducts == null ? List.<String>of() : purchasedProducts) {
            validateChildIfConfigured("product", product, subSolutionItem,
                    "产品“" + product + "”不属于所选细分解决方案");
        }
        validateIfConfigured("track", track);
        DictionaryItem industryItem = validateIfConfigured("industry", industry);
        DictionaryItem subIndustryItem = validateIfConfigured("sub_industry", subIndustry);
        if (subIndustryItem != null && industryItem != null) {
            if (subIndustryItem.getParent() == null
                    || !Objects.equals(subIndustryItem.getParent().getId(), industryItem.getId())) {
                throw BusinessException.badRequest("子行业不属于所选行业");
            }
        }
    }

    private DictionaryItem validateIfConfigured(String type, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        List<DictionaryItem> configured = repository.findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(type);
        if (configured.isEmpty()) {
            return null;
        }
        return configured.stream()
                .filter(item -> item.getValue().equalsIgnoreCase(value.trim()))
                .findFirst()
                .orElseThrow(() -> BusinessException.badRequest("“" + value + "”不是有效的" + type + "字典值"));
    }

    private DictionaryItem validateChildIfConfigured(String type, String value,
                                                      DictionaryItem expectedParent, String errorMessage) {
        if (value == null || value.isBlank()) {
            return null;
        }
        List<DictionaryItem> configured = repository.findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(type);
        if (configured.isEmpty()) {
            throw BusinessException.badRequest(errorMessage);
        }
        if (expectedParent == null) {
            throw BusinessException.badRequest(errorMessage);
        }
        return configured.stream()
                .filter(item -> item.getValue().equalsIgnoreCase(value.trim()))
                .filter(item -> item.getParent() != null
                        && Objects.equals(item.getParent().getId(), expectedParent.getId()))
                .findFirst()
                .orElseThrow(() -> BusinessException.badRequest(errorMessage));
    }

    private boolean isRequestedRoot(DictionaryItem item, String type) {
        if (type == null) {
            return item.getParent() == null;
        }
        if (item.getType().equals(type) && item.getParent() == null) {
            return true;
        }
        return item.getType().equals(type) && "sub_industry".equals(type);
    }

    private DictionaryItem resolveParent(Long parentId, String type, Long currentId) {
        if (parentId == null) {
            if (Set.of("sub_industry", "sub_solution", "product").contains(type)) {
                throw BusinessException.badRequest(typeLabel(type) + "必须选择上级");
            }
            return null;
        }
        if (Objects.equals(parentId, currentId)) {
            throw BusinessException.badRequest("字典项不能以自身作为上级");
        }
        DictionaryItem parent = getActive(parentId);
        if ("sub_industry".equals(type) && !"industry".equals(parent.getType())) {
            throw BusinessException.badRequest("子行业的上级必须是行业字典项");
        }
        if ("sub_solution".equals(type) && !"solution".equals(parent.getType())) {
            throw BusinessException.badRequest("细分解决方案的上级必须是解决方案");
        }
        if ("product".equals(type) && !"sub_solution".equals(parent.getType())) {
            throw BusinessException.badRequest("产品的上级必须是细分解决方案");
        }
        return parent;
    }

    private void ensureNoDuplicate(String type, String value, DictionaryItem parent, Long excludeId) {
        Long parentId = parent == null ? null : parent.getId();
        boolean duplicate = repository.findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(type).stream()
                .filter(item -> !Objects.equals(item.getId(), excludeId))
                .anyMatch(item -> item.getValue().equalsIgnoreCase(value)
                        && Objects.equals(item.getParent() == null ? null : item.getParent().getId(), parentId));
        if (duplicate) {
            throw BusinessException.conflict("同级下已存在相同字典值");
        }
    }

    private boolean isReferenced(DictionaryItem item) {
        return projectRepository.findAllByDeletedFalseOrderByIdAsc().stream()
                .anyMatch(project -> matchesProject(project, item));
    }

    private boolean matchesProject(Project project, DictionaryItem item) {
        String projectValue = switch (item.getType()) {
            case "safety_space" -> project.getSafetySpace();
            case "solution" -> project.getSolution();
            case "sub_solution" -> project.getSubSolution();
            case "product" -> project.getPurchasedProducts().contains(item.getValue()) ? item.getValue() : null;
            case "track" -> project.getTrack();
            case "industry" -> project.getIndustry();
            case "sub_industry" -> project.getSubIndustry();
            default -> null;
        };
        if (!Objects.equals(projectValue, item.getValue())) {
            return false;
        }
        if (item.getParent() == null) {
            return true;
        }
        return switch (item.getType()) {
            case "sub_industry" -> Objects.equals(project.getIndustry(), item.getParent().getValue());
            case "sub_solution" -> Objects.equals(project.getSolution(), item.getParent().getValue());
            case "product" -> Objects.equals(project.getSubSolution(), item.getParent().getValue());
            default -> true;
        };
    }

    private void cascadeProjectValue(DictionaryItem item, String newValue) {
        for (Project project : projectRepository.findAllByDeletedFalseOrderByIdAsc()) {
            if (!matchesProject(project, item)) {
                continue;
            }
            String field = item.getType();
            String oldValue = item.getValue();
            switch (field) {
                case "safety_space" -> project.setSafetySpace(newValue);
                case "solution" -> project.setSolution(newValue);
                case "sub_solution" -> project.setSubSolution(newValue);
                case "product" -> project.setPurchasedProducts(project.getPurchasedProducts().stream()
                        .map(value -> value.equals(oldValue) ? newValue : value).toList());
                case "track" -> project.setTrack(newValue);
                case "industry" -> project.setIndustry(newValue);
                case "sub_industry" -> project.setSubIndustry(newValue);
                default -> throw BusinessException.conflict("该类型不支持自动更新项目引用");
            }
            changeLogService.log(project, field, oldValue, newValue, ChangeLogService.SOURCE_MANUAL);
        }
    }

    private DictionaryItem getActive(Long id) {
        return repository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> BusinessException.notFound("字典项不存在"));
    }

    private String normalizeType(String type) {
        return clean(type).toLowerCase(Locale.ROOT);
    }

    private String clean(String value) {
        return value.trim();
    }

    private String typeLabel(String type) {
        return switch (type) {
            case "sub_industry" -> "子行业";
            case "sub_solution" -> "细分解决方案";
            case "product" -> "产品";
            default -> "字典项";
        };
    }

    private DictionaryNodeResponse toResponse(DictionaryItem item) {
        return new DictionaryNodeResponse(item.getId(), item.getType(), item.getValue(),
                item.getParent() == null ? null : item.getParent().getId(), item.getSortOrder(),
                item.getCreatedAt(), item.getUpdatedAt(), List.of());
    }

    private static final class MutableNode {
        private final DictionaryItem item;
        private final List<MutableNode> children = new ArrayList<>();

        private MutableNode(DictionaryItem item) {
            this.item = item;
        }

        private DictionaryNodeResponse toResponse() {
            List<DictionaryNodeResponse> childResponses = children.stream()
                    .sorted(Comparator.comparingInt((MutableNode node) -> node.item.getSortOrder())
                            .thenComparing(node -> node.item.getId()))
                    .map(MutableNode::toResponse)
                    .toList();
            return new DictionaryNodeResponse(item.getId(), item.getType(), item.getValue(),
                    item.getParent() == null ? null : item.getParent().getId(), item.getSortOrder(),
                    item.getCreatedAt(), item.getUpdatedAt(), childResponses);
        }
    }
}
