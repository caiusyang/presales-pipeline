package com.presales.pipeline.backup;

import com.presales.pipeline.backup.dto.BackupResponse;
import com.presales.pipeline.common.api.ApiResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;

@RestController
@RequestMapping("/api/backup")
public class BackupController {

    private final BackupService service;

    public BackupController(BackupService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<BackupResponse>> exportAll() {
        String date = LocalDate.now(ZoneId.of("Asia/Shanghai")).toString();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=presales-pipeline-backup-" + date + ".json")
                .body(ApiResponse.success(service.exportAll()));
    }
}
