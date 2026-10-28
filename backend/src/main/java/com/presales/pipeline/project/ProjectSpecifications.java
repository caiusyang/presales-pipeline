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
    public static Specification<Project> people(Long personId,String hcsStatus){return(root,query,cb)->{
        var predicates=new ArrayList<Predicate>();if(hcsStatus!=null&&!hcsStatus.isBlank())predicates.add(cb.equal(root.get("hcsStatus"),hcsStatus));
        if(personId!=null){var sub=query.subquery(Long.class);var person=sub.from(com.presales.pipeline.people.ProjectPerson.class);sub.select(person.get("id")).where(cb.equal(person.get("project").get("id"),root.get("id")),cb.equal(person.get("person").get("id"),personId));predicates.add(cb.exists(sub));}
        return cb.and(predicates.toArray(Predicate[]::new));
    };}
    public static Specification<Project> solutions(String solution,String subSolution){return(root,query,cb)->{
        if((solution==null||solution.isBlank())&&(subSolution==null||subSolution.isBlank()))return cb.conjunction();
        var sub=query.subquery(Long.class);var link=sub.from(com.presales.pipeline.solution.ProjectSolution.class);var predicates=new ArrayList<Predicate>();predicates.add(cb.equal(link.get("project").get("id"),root.get("id")));
        if(solution!=null&&!solution.isBlank())predicates.add(cb.equal(link.get("solution").get("value"),solution));
        if(subSolution!=null&&!subSolution.isBlank())predicates.add(cb.equal(link.get("subSolution").get("value"),subSolution));
        sub.select(link.get("id")).where(predicates.toArray(Predicate[]::new));return cb.exists(sub);
    };}

    public static Specification<Project> actions(String range,boolean sort){return(root,query,cb)->{
        var today=java.time.LocalDate.now(com.presales.pipeline.common.config.BusinessTime.ZONE);var date=root.<java.time.LocalDate>get("nextActionDate");
        if(sort && query.getResultType()!=Long.class && query.getResultType()!=long.class){
            var priority=cb.<Integer>selectCase().when(cb.isNull(date),3).when(cb.lessThan(date,today),0).when(cb.equal(date,today),1).otherwise(2);
            query.orderBy(cb.asc(priority),cb.asc(date),cb.asc(root.get("id")));
        }
        if(range==null||range.isBlank())return cb.conjunction();
        return switch(range){case "overdue"->cb.lessThan(date,today);case "today"->cb.equal(date,today);case "next7"->cb.and(cb.greaterThan(date,today),cb.lessThanOrEqualTo(date,today.plusDays(7)));case "unscheduled"->cb.isNull(date);default->throw com.presales.pipeline.common.exception.BusinessException.badRequest("行动筛选不正确");};
    };}

    public static Specification<Project> filter(String industry,
                                                String track,
                                                String projectStatus,
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
                predicates.add(track.equals("__unclassified__")?builder.or(builder.isNull(root.get("track")),builder.equal(root.get("track"),"")):builder.equal(root.get("track"), track.trim()));
            }
            if (projectStatus != null && !projectStatus.isBlank()) {
                predicates.add(builder.equal(root.get("projectStatus"), projectStatus.trim()));
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
