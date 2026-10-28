package com.presales.pipeline.migration;
import org.springframework.data.jpa.repository.*;
import java.util.List;
public interface MigrationIssueRepository extends JpaRepository<MigrationIssue,Long>{
    List<MigrationIssue> findAllByResolvedFalseOrderByIdAsc();
    List<MigrationIssue> findByProjectIdAndArea(Long projectId,String area);
    @Modifying @Query("delete from MigrationIssue i where i.projectId=:id") void deleteByProject(Long id);
}
