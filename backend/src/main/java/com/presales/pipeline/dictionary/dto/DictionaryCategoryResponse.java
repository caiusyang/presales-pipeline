package com.presales.pipeline.dictionary.dto;

import java.time.LocalDateTime;

public record DictionaryCategoryResponse(Long id, String type, String label, boolean builtIn, int sortOrder,
                                         LocalDateTime createdAt, LocalDateTime updatedAt) { }
