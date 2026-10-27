package com.presales.pipeline.dictionary;

import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.config.CustomFieldDefinitionRepository;
import com.presales.pipeline.dictionary.dto.DictionaryCategoryRequest;
import com.presales.pipeline.dictionary.dto.DictionaryCategoryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class DictionaryCategoryService {
    public static final Set<String> CHILD_TYPES = Set.of("sub_industry", "sub_solution", "product");
    public static final Set<String> BUILT_IN_TYPES = Set.of("track", "industry", "solution", "sub_industry", "sub_solution", "product");
    private final DictionaryCategoryRepository categories;
    private final DictionaryRepository items;
    private final CustomFieldDefinitionRepository fields;

    public DictionaryCategoryService(DictionaryCategoryRepository categories, DictionaryRepository items,
                                     CustomFieldDefinitionRepository fields) {
        this.categories = categories; this.items = items; this.fields = fields;
    }

    @Transactional
    public void initialize() {
        List<String> types = List.of("track", "industry", "solution");
        Map<String, String> labels = Map.of("track", "赛道", "industry", "行业", "solution", "解决方案");
        for (int i = 0; i < types.size(); i++) {
            String type = types.get(i);
            if (categories.findByType(type).isPresent()) continue;
            DictionaryCategory category = new DictionaryCategory();
            category.setType(type); category.setLabel(labels.get(type)); category.setBuiltIn(true); category.setSortOrder((i + 1) * 10);
            categories.save(category);
        }
        items.findAllByDeletedFalseOrderByTypeAscSortOrderAscIdAsc().stream().map(DictionaryItem::getType).distinct()
                .filter(type -> !BUILT_IN_TYPES.contains(type)).forEach(this::ensureLegacyCategory);
    }

    @Transactional(readOnly = true)
    public List<DictionaryCategoryResponse> list() {
        return categories.findAllByDeletedFalseOrderBySortOrderAscIdAsc().stream().map(this::response).toList();
    }

    @Transactional
    public DictionaryCategoryResponse create(DictionaryCategoryRequest request) {
        if (BUILT_IN_TYPES.contains(request.type())) throw BusinessException.conflict("该标识由内置字典保留");
        DictionaryCategory category = categories.findByType(request.type()).orElseGet(DictionaryCategory::new);
        if (category.getId() != null && !category.isDeleted()) throw BusinessException.conflict("字典分类标识已存在");
        category.setType(request.type()); category.setLabel(request.label().trim()); category.setSortOrder(request.sortOrder());
        category.setDeleted(false); category.setBuiltIn(false);
        return response(categories.save(category));
    }

    @Transactional
    public DictionaryCategoryResponse update(Long id, DictionaryCategoryRequest request) {
        DictionaryCategory category = active(id);
        if (category.isBuiltIn()) throw BusinessException.conflict("内置字典分类不能修改");
        if (!category.getType().equals(request.type())) throw BusinessException.conflict("字典分类标识不能修改");
        category.setLabel(request.label().trim()); category.setSortOrder(request.sortOrder());
        return response(category);
    }

    @Transactional
    public void delete(Long id) {
        DictionaryCategory category = active(id);
        if (category.isBuiltIn()) throw BusinessException.conflict("内置字典分类不能删除");
        if (!items.findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(category.getType()).isEmpty())
            throw BusinessException.conflict("该字典分类仍有字典值，请先删除字典值");
        if (fields.findAll().stream().anyMatch(field -> category.getType().equals(field.getDictionaryType())))
            throw BusinessException.conflict("该字典分类已关联自定义字段，不能删除");
        category.setDeleted(true);
    }

    @Transactional
    public void ensureLegacyCategory(String type) {
        if (BUILT_IN_TYPES.contains(type)) return;
        if (categories.findByType(type).isPresent()) return;
        DictionaryCategory category = new DictionaryCategory();
        category.setType(type); category.setLabel(type); category.setSortOrder(100);
        categories.save(category);
    }

    private DictionaryCategory active(Long id) {
        return categories.findByIdAndDeletedFalse(id).orElseThrow(() -> BusinessException.notFound("字典分类不存在"));
    }
    private DictionaryCategoryResponse response(DictionaryCategory category) {
        return new DictionaryCategoryResponse(category.getId(), category.getType(), category.getLabel(), category.isBuiltIn(),
                category.getSortOrder(), category.getCreatedAt(), category.getUpdatedAt());
    }
}
