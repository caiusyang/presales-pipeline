package com.presales.pipeline.progress;
import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.tasks.*;
import com.presales.pipeline.audit.OperatorProvider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/progress/repair")
public class ProgressRepairController {
    private final ProgressRepairService service;private final BatchJobRunner runner;private final JobStore store;private final OperatorProvider operator;
    public ProgressRepairController(ProgressRepairService service,BatchJobRunner runner,JobStore store,OperatorProvider operator){this.service=service;this.runner=runner;this.store=store;this.operator=operator;}
    public record Repairs(@NotBlank String requestId,@Valid @NotEmpty @Size(max=5000) List<ProgressRepairService.Repair> repairs){}
    @GetMapping public ApiResponse<?> preview(@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="100")int size,@RequestParam(required=false)Long projectId){return ApiResponse.success(service.preview(page,size,projectId));}
    @PostMapping("/jobs") public ApiResponse<?> repair(@Valid @RequestBody Repairs request){return ApiResponse.success(store.view(runner.submit(request.requestId(),"PROGRESS_REPAIR",request.repairs(),operator.currentOperator())));}
}
