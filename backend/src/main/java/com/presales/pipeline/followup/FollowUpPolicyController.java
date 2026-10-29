package com.presales.pipeline.followup;
import com.presales.pipeline.common.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/config/follow-up-policy")
public class FollowUpPolicyController {
    private final FollowUpPolicyService service;

    public FollowUpPolicyController(FollowUpPolicyService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<FollowUpPolicyService.Policy> get() {
        return ApiResponse.success(service.get());
    }

    @PutMapping
    public ApiResponse<FollowUpPolicyService.Policy> save(@Valid @RequestBody FollowUpPolicyService.Policy policy) {
        return ApiResponse.success(service.save(policy));
    }
}
