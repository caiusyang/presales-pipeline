package com.presales.pipeline.dictionary;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.dictionary.dto.DictionaryNodeResponse;
import com.presales.pipeline.dictionary.dto.DictionaryRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dictionaries")
public class DictionaryController {

    private final DictionaryService service;

    public DictionaryController(DictionaryService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<DictionaryNodeResponse>> tree(@RequestParam(required = false) String type) {
        return ApiResponse.success(service.tree(type));
    }

    @PostMapping
    public ApiResponse<DictionaryNodeResponse> create(@Valid @RequestBody DictionaryRequest request) {
        return ApiResponse.success("字典项已创建", service.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<DictionaryNodeResponse> update(@PathVariable Long id,
                                                      @Valid @RequestBody DictionaryRequest request) {
        return ApiResponse.success("字典项已更新", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("字典项已删除", null);
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<DictionaryNodeResponse> restore(@PathVariable Long id) {
        return ApiResponse.success("字典项已恢复", service.restore(id));
    }
}
