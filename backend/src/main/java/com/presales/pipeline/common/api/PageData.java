package com.presales.pipeline.common.api;

import org.springframework.data.domain.Page;

import java.util.List;

public record PageData<T>(
        List<T> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <S, T> PageData<T> from(Page<S> page, List<T> items) {
        return new PageData<>(items, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
