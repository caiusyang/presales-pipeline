package com.presales.pipeline.progress;

import com.presales.pipeline.audit.ChangeLogService;
import com.presales.pipeline.common.exception.BusinessException;
import com.presales.pipeline.progress.dto.ProgressCreateRequest;
import com.presales.pipeline.progress.dto.ProgressResponse;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.project.ProjectService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class ProgressService {

    private final ProgressLogRepository repository;
    private final ProjectService projectService;
    private final ChangeLogService changeLogService;

    public ProgressService(ProgressLogRepository repository,
                           ProjectService projectService,
                           ChangeLogService changeLogService) {
        this.repository = repository;
        this.projectService = projectService;
        this.changeLogService = changeLogService;
    }

    @Transactional(readOnly = true)
    public List<ProgressResponse> list(Long projectId) {
        List<ProgressLog> logs;
        if (projectId == null) {
            logs = repository.findAllActiveWithProject();
        } else {
            projectService.getActiveEntity(projectId);
            logs = repository.findAllByProjectIdAndDeletedFalseOrderByLogDateDescIdDesc(projectId);
        }
        return logs.stream().map(this::toResponse).toList();
    }

    @Transactional
    public ProgressResponse create(ProgressCreateRequest request) {
        Project project = projectService.getActiveEntity(request.projectId());
        String content = request.content().trim();
        ProgressLog log = repository.save(new ProgressLog(project, request.logDate(), content));
        changeLogService.log(project, "progress." + log.getId(), null,
                request.logDate() + "：" + content, ChangeLogService.SOURCE_MANUAL);
        return toResponse(log);
    }

    @Transactional
    public ProgressLog addIfAbsent(Project project, LocalDate date, String content, String source) {
        String normalized = content.trim();
        if (repository.existsByProjectIdAndLogDateAndContentAndDeletedFalse(project.getId(), date, normalized)) {
            return null;
        }
        ProgressLog log = repository.save(new ProgressLog(project, date, normalized));
        changeLogService.log(project, "progress." + log.getId(), null,
                date + "：" + normalized, source);
        return log;
    }

    @Transactional
    public void delete(Long id) {
        ProgressLog log = repository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> BusinessException.notFound("进展记录不存在"));
        projectService.getActiveEntity(log.getProject().getId());
        changeLogService.log(log.getProject(), "progress." + id,
                log.getLogDate() + "：" + log.getContent(), null, ChangeLogService.SOURCE_MANUAL);
        log.setDeleted(true);
    }

    @Transactional
    public ProgressResponse restore(Long id) {
        ProgressLog log = repository.findById(id)
                .orElseThrow(() -> BusinessException.notFound("进展记录不存在"));
        projectService.getActiveEntity(log.getProject().getId());
        if (log.isDeleted()) {
            log.setDeleted(false);
            changeLogService.log(log.getProject(), "progress." + id, null,
                    log.getLogDate() + "：" + log.getContent(), ChangeLogService.SOURCE_MANUAL);
        }
        return toResponse(log);
    }

    private ProgressResponse toResponse(ProgressLog log) {
        return new ProgressResponse(log.getId(), log.getProject().getId(), log.getLogDate(), log.getContent(),
                log.getCreatedAt(), log.getUpdatedAt());
    }
}
