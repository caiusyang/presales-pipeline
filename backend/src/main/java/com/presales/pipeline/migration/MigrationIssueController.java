package com.presales.pipeline.migration;
import com.presales.pipeline.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/migration-issues")
public class MigrationIssueController {
    private final MigrationIssueRepository issues;
    public MigrationIssueController(MigrationIssueRepository issues){this.issues=issues;}
    @GetMapping public ApiResponse<?> list(){return ApiResponse.success(issues.findAllByResolvedFalseOrderByIdAsc());}
}
