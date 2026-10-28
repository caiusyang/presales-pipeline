package com.presales.pipeline.people;
import com.presales.pipeline.common.model.BaseEntity;
import com.presales.pipeline.project.Project;
import jakarta.persistence.*;
@Entity @Table(name="project_responsibles",uniqueConstraints=@UniqueConstraint(columnNames={"project_id","person_id","source"}))
public class ProjectPerson extends BaseEntity{
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="project_id",nullable=false) public Project project;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="person_id",nullable=false) public Person person;
    @Column(nullable=false,length=16) public String source;
    @Column(length=255) public String role;
}
