package com.presales.pipeline.importing;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.importing.dto.ImportRequest;
import com.presales.pipeline.importing.dto.ImportResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/import")
public class ImportController {

    private final ImportService service;

    public ImportController(ImportService service) {
        this.service = service;
    }

    @PostMapping
    public ApiResponse<ImportResponse> execute(@Valid @RequestBody ImportRequest request) {
        String message = request.dryRun() ? "导入预检完成" : "导入完成";
        return ApiResponse.success(message, service.execute(request));
    }
}
