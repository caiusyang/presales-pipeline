package com.presales.pipeline.solution;
import com.presales.pipeline.project.Project;
import com.presales.pipeline.dictionary.DictionaryItem;
import com.presales.pipeline.common.model.BaseEntity;
import jakarta.persistence.*;
@Entity @Table(name="project_solutions",uniqueConstraints=@UniqueConstraint(columnNames={"project_id","solution_id","sub_solution_id"}))
public class ProjectSolution extends BaseEntity {
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="project_id",nullable=false) public Project project;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="solution_id",nullable=false) public DictionaryItem solution;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="sub_solution_id") public DictionaryItem subSolution;
}
