package com.presales.pipeline;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class PresalesPipelineApplication {

    public static void main(String[] args) {
        SpringApplication.run(PresalesPipelineApplication.class, args);
    }
}
