package com.presales.pipeline.revenue;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RevenueRepository extends JpaRepository<Revenue, Long> {
    interface Total { Long getProjectId(); java.math.BigDecimal getAmount(); }
    @Query("select r.project.id as projectId,sum(r.amount) as amount from Revenue r where r.deleted=false and r.project.id in :ids and (:start is null or r.month>=:start) and (:end is null or r.month<=:end) group by r.project.id")
    List<Total> totals(@Param("ids") List<Long> ids,@Param("start") String start,@Param("end") String end);
    @Query("select distinct r.month from Revenue r where r.deleted=false and r.project.deleted=false order by r.month")
    List<String> activeMonths();
    @Modifying
    @Query("delete from Revenue r where r.project.id = :projectId")
    void deleteAllByProjectId(@Param("projectId") Long projectId);

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
