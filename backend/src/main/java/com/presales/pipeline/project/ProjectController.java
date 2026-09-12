package com.presales.pipeline.project;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.common.api.PageData;
import com.presales.pipeline.project.dto.ProjectDetailResponse;
import com.presales.pipeline.project.dto.ProjectRequest;
import com.presales.pipeline.project.dto.ProjectResponse;
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

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageData<ProjectResponse>> list(
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String track,
            @RequestParam(required = false) String projectStatus,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String startMonth,
            @RequestParam(required = false) String endMonth,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "false") boolean deleted) {
        return ApiResponse.success(service.list(industry, track, projectStatus, keyword, startMonth, endMonth,
                page, size, sortBy, sortDirection, deleted));
    }

    @GetMapping("/{id}/detail")
    public ApiResponse<ProjectDetailResponse> detail(@PathVariable Long id) {
        return ApiResponse.success(service.detail(id));
    }

    @PostMapping
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody ProjectRequest request) {
        return ApiResponse.success("项目已创建", service.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<ProjectResponse> update(@PathVariable Long id, @Valid @RequestBody ProjectRequest request) {
        return ApiResponse.success("项目已更新", service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.success("项目已移入回收站", null);
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<ProjectResponse> restore(@PathVariable Long id) {
        return ApiResponse.success("项目已恢复", service.restore(id));
    }
}
