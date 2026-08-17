package com.presales.pipeline.revenue;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.revenue.dto.RevenueBatchRequest;
import com.presales.pipeline.revenue.dto.RevenueBatchResponse;
import com.presales.pipeline.revenue.dto.RevenueMatrixResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/revenues")
public class RevenueController {

    private final RevenueService service;

    public RevenueController(RevenueService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<RevenueMatrixResponse> matrix(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String startMonth,
            @RequestParam(required = false) String endMonth,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String track,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(service.matrix(year, startMonth, endMonth, industry, track, keyword));
    }

    @PutMapping
    public ApiResponse<RevenueBatchResponse> saveBatch(@Valid @RequestBody RevenueBatchRequest request) {
        return ApiResponse.success("收入已批量保存", service.saveBatch(request));
    }
}
