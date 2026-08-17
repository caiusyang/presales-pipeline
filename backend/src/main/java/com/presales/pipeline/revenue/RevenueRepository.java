package com.presales.pipeline.revenue;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RevenueRepository extends JpaRepository<Revenue, Long> {
    Optional<Revenue> findByProjectIdAndMonth(Long projectId, String month);
    Optional<Revenue> findByIdAndDeletedFalse(Long id);
    List<Revenue> findAllByProjectIdAndDeletedFalseOrderByMonthAsc(Long projectId);
    List<Revenue> findAllByProjectIdInAndDeletedFalse(List<Long> projectIds);
    List<Revenue> findAllByDeletedFalseOrderByMonthAsc();

    @Query("""
            select r from Revenue r
            join fetch r.project p
            where r.deleted = false and p.deleted = false
              and (:startMonth is null or r.month >= :startMonth)
              and (:endMonth is null or r.month <= :endMonth)
            order by r.month asc, p.id asc
            """)
    List<Revenue> findActiveInRange(@Param("startMonth") String startMonth,
                                    @Param("endMonth") String endMonth);
}
