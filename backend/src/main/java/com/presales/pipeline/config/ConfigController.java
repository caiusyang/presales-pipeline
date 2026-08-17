package com.presales.pipeline.config;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.config.dto.CustomFieldRequest;
import com.presales.pipeline.config.dto.CustomFieldResponse;
import com.presales.pipeline.config.dto.ExportTemplateRequest;
import com.presales.pipeline.config.dto.ExportTemplateResponse;
import com.presales.pipeline.config.dto.ImportMappingRequest;
import com.presales.pipeline.config.dto.ImportMappingResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    private final ConfigService service;

    public ConfigController(ConfigService service) {
        this.service = service;
    }

    @GetMapping("/import-mappings")
    public ApiResponse<List<ImportMappingResponse>> listImportMappings() {
        return ApiResponse.success(service.listImportMappings());
    }

    @GetMapping("/import-mappings/{id}")
    public ApiResponse<ImportMappingResponse> getImportMapping(@PathVariable Long id) {
        return ApiResponse.success(service.getImportMapping(id));
    }

    @PostMapping("/import-mappings")
    public ApiResponse<ImportMappingResponse> createImportMapping(@Valid @RequestBody ImportMappingRequest request) {
        return ApiResponse.success("导入映射方案已创建", service.createImportMapping(request));
    }

    @PutMapping("/import-mappings/{id}")
    public ApiResponse<ImportMappingResponse> updateImportMapping(@PathVariable Long id,
                                                                  @Valid @RequestBody ImportMappingRequest request) {
        return ApiResponse.success("导入映射方案已更新", service.updateImportMapping(id, request));
    }

    @DeleteMapping("/import-mappings/{id}")
    public ApiResponse<Void> deleteImportMapping(@PathVariable Long id) {
        service.deleteImportMapping(id);
        return ApiResponse.success("导入映射方案已删除", null);
    }

    @PostMapping("/import-mappings/{id}/restore")
    public ApiResponse<ImportMappingResponse> restoreImportMapping(@PathVariable Long id) {
        return ApiResponse.success("导入映射方案已恢复", service.restoreImportMapping(id));
    }

    @GetMapping("/export-templates")
    public ApiResponse<List<ExportTemplateResponse>> listExportTemplates() {
        return ApiResponse.success(service.listExportTemplates());
    }

    @GetMapping("/export-templates/{id}")
    public ApiResponse<ExportTemplateResponse> getExportTemplate(@PathVariable Long id) {
        return ApiResponse.success(service.getExportTemplate(id));
    }

    @PostMapping("/export-templates")
    public ApiResponse<ExportTemplateResponse> createExportTemplate(@Valid @RequestBody ExportTemplateRequest request) {
        return ApiResponse.success("导出模板已创建", service.createExportTemplate(request));
    }

    @PutMapping("/export-templates/{id}")
    public ApiResponse<ExportTemplateResponse> updateExportTemplate(@PathVariable Long id,
                                                                    @Valid @RequestBody ExportTemplateRequest request) {
        return ApiResponse.success("导出模板已更新", service.updateExportTemplate(id, request));
    }

    @DeleteMapping("/export-templates/{id}")
    public ApiResponse<Void> deleteExportTemplate(@PathVariable Long id) {
        service.deleteExportTemplate(id);
        return ApiResponse.success("导出模板已删除", null);
    }

    @PostMapping("/export-templates/{id}/restore")
    public ApiResponse<ExportTemplateResponse> restoreExportTemplate(@PathVariable Long id) {
        return ApiResponse.success("导出模板已恢复", service.restoreExportTemplate(id));
    }

    @GetMapping("/custom-fields")
    public ApiResponse<List<CustomFieldResponse>> listCustomFields() {
        return ApiResponse.success(service.listCustomFields());
    }

    @GetMapping("/custom-fields/{id}")
    public ApiResponse<CustomFieldResponse> getCustomField(@PathVariable Long id) {
        return ApiResponse.success(service.getCustomField(id));
    }

    @PostMapping("/custom-fields")
    public ApiResponse<CustomFieldResponse> createCustomField(@Valid @RequestBody CustomFieldRequest request) {
        return ApiResponse.success("自定义字段已创建", service.createCustomField(request));
    }

    @PutMapping("/custom-fields/{id}")
    public ApiResponse<CustomFieldResponse> updateCustomField(@PathVariable Long id,
                                                              @Valid @RequestBody CustomFieldRequest request) {
        return ApiResponse.success("自定义字段已更新", service.updateCustomField(id, request));
    }

    @DeleteMapping("/custom-fields/{id}")
    public ApiResponse<Void> deleteCustomField(@PathVariable Long id) {
        service.deleteCustomField(id);
        return ApiResponse.success("自定义字段已删除", null);
    }

    @PostMapping("/custom-fields/{id}/restore")
    public ApiResponse<CustomFieldResponse> restoreCustomField(@PathVariable Long id) {
        return ApiResponse.success("自定义字段已恢复", service.restoreCustomField(id));
    }
}
