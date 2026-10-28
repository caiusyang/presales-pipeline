package com.presales.pipeline.tasks;

import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.audit.OperatorProvider;
import com.presales.pipeline.importing.dto.ImportRequest;
import com.presales.pipeline.exporting.dto.ExportRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @RequestMapping("/api")
public class BatchJobController {
    private final JobStore store;private final BatchJobRunner runner;private final OperatorProvider operator;
    public BatchJobController(JobStore store,BatchJobRunner runner,OperatorProvider operator){this.store=store;this.runner=runner;this.operator=operator;}
    public record ProjectBatch(@NotBlank String requestId,@Pattern(regexp="delete|restore|purge") @NotNull String operation,@NotEmpty @Size(max=5000) List<@Positive Long> projectIds){}
    public record ImportJob(@NotBlank String requestId,@Valid @NotNull ImportRequest request){}
    public record ExportJob(@NotBlank String requestId,@Valid @NotNull ExportRequest request){}
    public record Retry(@NotBlank @Size(max=128) String requestId){}
    @PostMapping("/projects/batch") public ApiResponse<?> batch(@Valid @RequestBody ProjectBatch input){return ApiResponse.success(store.view(runner.submit(input.requestId(),"PROJECT_"+input.operation().toUpperCase(Locale.ROOT),input.projectIds().stream().distinct().toList(),operator.currentOperator())));}
    @PostMapping("/import/jobs") public ApiResponse<?> imports(@Valid @RequestBody ImportJob input){return ApiResponse.success(store.view(runner.submit(input.requestId(),input.request().dryRun()?"PREFLIGHT":"IMPORT",input.request(),operator.currentOperator())));}
    @PostMapping("/export/jobs") public ApiResponse<?> exports(@Valid @RequestBody ExportJob input){return ApiResponse.success(store.view(runner.submit(input.requestId(),"EXPORT",input.request(),operator.currentOperator())));}
    @GetMapping("/jobs") public ApiResponse<?> list(){return ApiResponse.success(store.list().stream().map(store::view).toList());}
    @GetMapping("/jobs/{id}") public ApiResponse<?> get(@PathVariable String id){return ApiResponse.success(store.view(store.get(id)));}
    @GetMapping("/jobs/{id}/items") public ApiResponse<?> items(@PathVariable String id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size){
        if(page<0||size<1||size>200)throw BusinessException.badRequest("分页参数不正确");
        var rows=store.page(id,page,size);return ApiResponse.success(Map.of("total",rows.getTotalElements(),"items",rows.stream().map(i->{var v=new LinkedHashMap<String,Object>();v.put("index",i.itemIndex);v.put("status",i.status);v.put("error",i.error);v.put("input",store.read(i.inputData,Object.class));v.put("result",i.resultData==null?null:store.read(i.resultData,Object.class));return v;}).toList()));
    }
    @GetMapping("/jobs/{id}/result") public ApiResponse<?> result(@PathVariable String id){return ApiResponse.success(runner.result(id));}
    @PostMapping("/jobs/{id}/retry") public ApiResponse<?> retry(@PathVariable String id,@Valid @RequestBody Retry retry){return ApiResponse.success(store.view(runner.retry(id,retry.requestId())));}
}
