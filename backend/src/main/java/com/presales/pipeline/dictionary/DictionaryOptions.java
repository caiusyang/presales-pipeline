package com.presales.pipeline.dictionary;

import com.presales.pipeline.common.exception.BusinessException;
import org.springframework.stereotype.Service;
import java.util.List;

/** Repository-only lookup shared by field validation and dictionary maintenance. */
@Service
public class DictionaryOptions {
    private final DictionaryCategoryRepository categories;
    private final DictionaryRepository items;
    public DictionaryOptions(DictionaryCategoryRepository categories, DictionaryRepository items) {
        this.categories = categories; this.items = items;
    }
    public List<String> resolve(String type) {
        DictionaryCategory category = categories.findByTypeAndDeletedFalse(type)
                .orElseThrow(() -> BusinessException.badRequest("关联的字典分类不存在"));
        if (category.isBuiltIn()) throw BusinessException.badRequest("自定义字段仅可关联自定义字典分类");
        return items.findAllByTypeAndDeletedFalseOrderBySortOrderAscIdAsc(type).stream().map(DictionaryItem::getValue).toList();
    }
}
