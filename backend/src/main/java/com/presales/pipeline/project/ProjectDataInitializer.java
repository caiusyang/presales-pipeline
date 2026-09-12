package com.presales.pipeline.project;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 为本机 H2 的 ddl-auto=update 运行方式补齐历史项目默认值；MySQL 由 Flyway 同步处理。 */
@Component
public class ProjectDataInitializer implements ApplicationRunner {

    private final ProjectRepository repository;

    public ProjectDataInitializer(ProjectRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        repository.findAll().forEach(Project::initializeLegacyDefaults);
    }
}
