package com.presales.pipeline.people;
import com.presales.pipeline.common.api.ApiResponse;
import com.presales.pipeline.tasks.*;
import com.presales.pipeline.audit.OperatorProvider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/config/people")
public class PeopleController {
    private final PeopleService people;private final BatchJobRunner jobs;private final JobStore store;private final OperatorProvider operator;
    public PeopleController(PeopleService people,BatchJobRunner jobs,JobStore store,OperatorProvider operator){this.people=people;this.jobs=jobs;this.store=store;this.operator=operator;}
    @GetMapping public ApiResponse<?> list(){return ApiResponse.success(people.list());}
    @PostMapping public ApiResponse<?> create(@Valid @RequestBody PeopleService.Input input){return ApiResponse.success(people.save(null,input));}
    @PutMapping("/{id}") public ApiResponse<?> update(@PathVariable Long id,@Valid @RequestBody PeopleService.Input input){return ApiResponse.success(people.save(id,input));}
    public record Import(@NotBlank @Size(max=128) String requestId,@NotEmpty @Size(max=5000) List<PeopleService.Input> people){}
    @PostMapping("/import") public ApiResponse<?> importPeople(@Valid @RequestBody Import input){return ApiResponse.success(store.view(jobs.submit(input.requestId(),"PEOPLE_IMPORT",input.people(),operator.currentOperator())));}
    @PostMapping("/match") public ApiResponse<?> match(@RequestBody List<PeopleService.Reference> input){if(input.size()>1000)throw com.presales.pipeline.common.exception.BusinessException.badRequest("匹配请求最多1000项");return ApiResponse.success(people.match(input));}
}
