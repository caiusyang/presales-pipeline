package com.presales.pipeline.project;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import com.presales.pipeline.product.ProjectProductService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 为本机 H2 的 ddl-auto=update 运行方式补齐历史项目默认值；MySQL 由 Flyway 同步处理。 */
@Component
public class ProjectDataInitializer implements ApplicationRunner {

    private final ProjectRepository repository;
    private final ProjectProductService projectProductService;

    public ProjectDataInitializer(ProjectRepository repository, ProjectProductService projectProductService) {
        this.repository = repository;
        this.projectProductService = projectProductService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        repository.findAll().forEach(project -> {
            project.initializeLegacyDefaults();
            projectProductService.sync(project, project.getPurchasedProducts());
        });
    }
}
