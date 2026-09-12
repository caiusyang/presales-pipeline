package com.presales.pipeline.customer;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.customer.dto.CustomerAnalysisResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
public class CustomerAnalysisController {

    private final CustomerAnalysisService service;

    public CustomerAnalysisController(CustomerAnalysisService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<CustomerAnalysisResponse>> list(@RequestParam(required = false) String keyword) {
        return ApiResponse.success(service.list(keyword));
    }
}
