package com.presales.pipeline.dictionary;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.dictionary.dto.DictionaryCategoryRequest;
import com.presales.pipeline.dictionary.dto.DictionaryCategoryResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/dictionary-categories")
public class DictionaryCategoryController {
    private final DictionaryCategoryService service;
    public DictionaryCategoryController(DictionaryCategoryService service) { this.service = service; }
    @GetMapping public ApiResponse<List<DictionaryCategoryResponse>> list() { return ApiResponse.success(service.list()); }
    @PostMapping public ApiResponse<DictionaryCategoryResponse> create(@Valid @RequestBody DictionaryCategoryRequest request) {
        return ApiResponse.success("字典分类已创建", service.create(request));
    }
    @PutMapping("/{id}") public ApiResponse<DictionaryCategoryResponse> update(@PathVariable Long id, @Valid @RequestBody DictionaryCategoryRequest request) {
        return ApiResponse.success("字典分类已更新", service.update(id, request));
    }
    @DeleteMapping("/{id}") public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id); return ApiResponse.success("字典分类已删除", null);
    }
}
