package com.presales.pipeline.exporting;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.exporting.dto.ExportFieldResponse;
import com.presales.pipeline.exporting.dto.ExportRequest;
import com.presales.pipeline.exporting.dto.ExportResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final ExportService service;

    public ExportController(ExportService service) {
        this.service = service;
    }

    @GetMapping("/fields")
    public ApiResponse<List<ExportFieldResponse>> availableFields(@RequestParam String scope) {
        return ApiResponse.success(service.availableFields(scope));
    }

    @PostMapping
    public ApiResponse<ExportResponse> export(@Valid @RequestBody ExportRequest request) {
        return ApiResponse.success("导出数据已生成", service.export(request));
    }
}
