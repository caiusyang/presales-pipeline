package com.presales.pipeline.progress;

import com.presales.pipeline.audit.ChangeLogService;
import com.presales.pipeline.project.ProjectService;
import com.presales.pipeline.common.exception.BusinessException;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class ProgressRepairService {
    private final ProgressLogRepository logs;private final ProjectService projects;private final ChangeLogService changes;
    private static final Pattern DATE=Pattern.compile("^(\\d{4})[-/年.](\\d{1,2})[-/月.](\\d{1,2})日?\\s*[:：]?\\s*(.+)$",Pattern.DOTALL);
    public ProgressRepairService(ProgressLogRepository logs,ProjectService projects,ChangeLogService changes){this.logs=logs;this.projects=projects;this.changes=changes;}
    public record Repair(@NotNull @Positive Long id,@NotNull LocalDate expectedLogDate,@NotNull String expectedContent,@NotNull LocalDate logDate,@NotBlank @Size(max=10000) String content,@NotBlank @Size(max=2000) String evidence){}
    @Transactional(readOnly=true) public Map<String,Object> preview(int page,int size,Long projectId){
        if(page<0||size<1||size>100)throw BusinessException.badRequest("每页1至100条");
        var result=logs.repairPage(projectId,PageRequest.of(page,size));
        return Map.of("total",result.getTotalElements(),"items",result.getContent().stream().map(log->{
            Map<String,Object> row=new LinkedHashMap<>();row.put("id",log.getId());row.put("projectId",log.getProject().getId());row.put("projectName",log.getProject().getProjectName());row.put("logDate",log.getLogDate());row.put("content",log.getContent());row.put("createdAt",log.getCreatedAt());
            String classification="manual",reason="没有能确定完整日期的原文，不自动更改";LocalDate proposed=null;String content=null;
            var match=DATE.matcher(log.getContent().trim());
            if(match.matches() && log.getContent().lines().filter(line->DATE.matcher(line.trim()).matches()).count()==1)try{
                proposed=LocalDate.of(Integer.parseInt(match.group(1)),Integer.parseInt(match.group(2)),Integer.parseInt(match.group(3)));content=match.group(4).trim();classification=proposed.equals(log.getLogDate())?"verified":"repairable";reason=classification.equals("verified")?"原文完整日期与记录日期一致":"可依据原文完整日期修正";
            }catch(DateTimeException error){reason="原文日期不存在，请人工核对原始文件";}
            row.put("classification",classification);row.put("reason",reason);row.put("proposedDate",proposed);row.put("proposedContent",content);return row;
        }).toList());
    }
    @Transactional public Long apply(Repair input){
        var original=logs.findById(input.id()).orElseThrow(()->BusinessException.notFound("进展不存在"));
        projects.getActiveEntityForUpdate(original.getProject().getId());
        var log=logs.findByIdForUpdate(input.id()).orElseThrow(()->BusinessException.notFound("进展不存在"));
        if(log.isDeleted())throw BusinessException.conflict("进展已删除");projects.getActiveEntity(log.getProject().getId());
        if(!log.getLogDate().equals(input.expectedLogDate())||!log.getContent().equals(input.expectedContent()))throw BusinessException.conflict("进展已变化，请重新预览");
        String content=input.content().trim();if(log.getLogDate().equals(input.logDate())&&log.getContent().equals(content))return log.getId();
        changes.log(log.getProject(),"progress."+log.getId(),log.getLogDate()+"："+log.getContent(),input.logDate()+"："+content+"\n修复依据："+input.evidence(),ChangeLogService.SOURCE_MANUAL);
        log.setLogDate(input.logDate());log.setContent(content);return log.getId();
    }
}
