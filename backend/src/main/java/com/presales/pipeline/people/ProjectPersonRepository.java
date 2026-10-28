package com.presales.pipeline.people;
import org.springframework.data.jpa.repository.*;
public interface ProjectPersonRepository extends JpaRepository<ProjectPerson,Long>{
    @Modifying @Query("delete from ProjectPerson r where r.project.id=:id") void deleteByProject(Long id);
}
