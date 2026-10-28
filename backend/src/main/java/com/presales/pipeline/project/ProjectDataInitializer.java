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
    private final com.presales.pipeline.product.ProjectProductRepository products;

    public ProjectDataInitializer(ProjectRepository repository, ProjectProductService projectProductService,com.presales.pipeline.product.ProjectProductRepository products) {
        this.products=products;
        this.repository = repository;
        this.projectProductService = projectProductService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        var owned=products.findAll().stream().collect(java.util.stream.Collectors.groupingBy(p->p.getProject().getId(),java.util.stream.Collectors.mapping(com.presales.pipeline.product.ProjectProduct::getProductCode,java.util.stream.Collectors.toSet())));
        try(var scope=com.presales.pipeline.importing.ImportReferenceScope.open()){repository.findAll().forEach(project -> {
            project.initializeLegacyDefaults();
            if(!new java.util.HashSet<>(project.getPurchasedProducts()).equals(owned.getOrDefault(project.getId(),java.util.Set.of())))projectProductService.sync(project, project.getPurchasedProducts());
        });}
    }
}
