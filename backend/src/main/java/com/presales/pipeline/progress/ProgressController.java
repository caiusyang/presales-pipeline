package com.presales.pipeline.progress;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.progress.dto.ProgressCreateRequest;
import com.presales.pipeline.progress.dto.ProgressResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService service;

    public ProgressController(ProgressService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<ProgressResponse>> list(@RequestParam(required = false) Long projectId) {
        return ApiResponse.success(service.list(projectId));
    }

    @PostMapping
    public ApiResponse<ProgressResponse> create(@Valid @RequestBody ProgressCreateRequest request) {
        return ApiResponse.success("进展已添加", service.create(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("进展已删除", null);
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<ProgressResponse> restore(@PathVariable Long id) {
        return ApiResponse.success("进展已恢复", service.restore(id));
    }
}
