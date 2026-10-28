package com.presales.pipeline.dictionary;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@org.springframework.core.annotation.Order(0)
public class DictionaryCategoryInitializer implements ApplicationRunner {
    private final DictionaryCategoryService categories;
    public DictionaryCategoryInitializer(DictionaryCategoryService categories) { this.categories = categories; }
    @Override public void run(ApplicationArguments args) { categories.initialize(); }
}
