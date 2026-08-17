package com.presales.pipeline.project;

import com.presales.pipeline.revenue.Revenue;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class ProjectSpecifications {

    private ProjectSpecifications() {
    }

    public static Specification<Project> filter(String industry,
                                                String track,
                                                String keyword,
                                                String startMonth,
                                                String endMonth,
                                                boolean deleted) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("deleted"), deleted));

            if (industry != null && !industry.isBlank()) {
                predicates.add(builder.equal(root.get("industry"), industry.trim()));
            }
            if (track != null && !track.isBlank()) {
                predicates.add(builder.equal(root.get("track"), track.trim()));
            }
            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("customerName")), pattern),
                        builder.like(builder.lower(root.get("projectName")), pattern),
                        builder.like(builder.lower(root.get("scenario")), pattern),
                        builder.like(builder.lower(root.get("keyNeeds")), pattern),
                        builder.like(builder.lower(root.get("keyRisks")), pattern)
                ));
            }
            if (startMonth != null || endMonth != null) {
                Subquery<Long> revenueExists = query.subquery(Long.class);
                var revenue = revenueExists.from(Revenue.class);
                List<Predicate> revenuePredicates = new ArrayList<>();
                revenuePredicates.add(builder.equal(revenue.get("project").get("id"), root.get("id")));
                revenuePredicates.add(builder.isFalse(revenue.get("deleted")));
                if (startMonth != null) {
                    revenuePredicates.add(builder.greaterThanOrEqualTo(revenue.get("month"), startMonth));
                }
                if (endMonth != null) {
                    revenuePredicates.add(builder.lessThanOrEqualTo(revenue.get("month"), endMonth));
                }
                revenueExists.select(revenue.get("id")).where(revenuePredicates.toArray(Predicate[]::new));
                predicates.add(builder.exists(revenueExists));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }
}
