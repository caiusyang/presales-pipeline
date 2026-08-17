package com.presales.pipeline.stats;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.stats.dto.RevenueStatsResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stats/revenue")
public class RevenueStatsController {

    private final RevenueStatsService service;

    public RevenueStatsController(RevenueStatsService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<RevenueStatsResponse> aggregate(
            @RequestParam(name = "dim", defaultValue = "project") String dimension,
            @RequestParam(required = false) Integer year) {
        return ApiResponse.success(service.aggregate(dimension, year));
    }
}
