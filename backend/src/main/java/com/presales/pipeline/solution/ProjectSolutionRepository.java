package com.presales.pipeline.solution;
import org.springframework.data.jpa.repository.*;
import java.util.List;
public interface ProjectSolutionRepository extends JpaRepository<ProjectSolution,Long> {
    @Query("select count(s)>0 from ProjectSolution s where s.solution.id=:id or s.subSolution.id=:id") boolean references(Long id);
    @Modifying @Query("delete from ProjectSolution s where s.project.id=:id") void deleteByProject(Long id);
    @Query("select s from ProjectSolution s join fetch s.project p join fetch s.solution left join fetch s.subSolution where p.deleted=false") List<ProjectSolution> active();
}
