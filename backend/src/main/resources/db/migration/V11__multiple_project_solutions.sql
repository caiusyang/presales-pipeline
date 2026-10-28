CREATE TABLE project_solutions (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT NOT NULL,
 solution_id BIGINT NOT NULL,
 sub_solution_id BIGINT NULL,
 created_at DATETIME(6) NOT NULL,
 updated_at DATETIME(6) NOT NULL,
 UNIQUE KEY uq_project_solution (project_id,solution_id,sub_solution_id),
 CONSTRAINT fk_project_solution_project FOREIGN KEY (project_id) REFERENCES projects(id),
 CONSTRAINT fk_project_solution_root FOREIGN KEY (solution_id) REFERENCES dictionaries(id),
 CONSTRAINT fk_project_solution_child FOREIGN KEY (sub_solution_id) REFERENCES dictionaries(id)
);
INSERT INTO project_solutions(project_id,solution_id,sub_solution_id,created_at,updated_at)
SELECT p.id,s.id,c.id,p.created_at,p.updated_at FROM projects p
JOIN dictionaries s ON s.type='solution' AND s.deleted=FALSE AND LOWER(s.item_value)=LOWER(p.solution)
LEFT JOIN dictionaries c ON c.type='sub_solution' AND c.deleted=FALSE AND c.parent_id=s.id AND LOWER(c.item_value)=LOWER(p.sub_solution)
WHERE NULLIF(TRIM(p.solution),'') IS NOT NULL AND (NULLIF(TRIM(p.sub_solution),'') IS NULL OR c.id IS NOT NULL)
AND (SELECT COUNT(*) FROM dictionaries ds WHERE ds.type='solution' AND ds.deleted=FALSE AND LOWER(ds.item_value)=LOWER(p.solution))=1
AND (NULLIF(TRIM(p.sub_solution),'') IS NULL OR (SELECT COUNT(*) FROM dictionaries dc WHERE dc.type='sub_solution' AND dc.deleted=FALSE AND dc.parent_id=s.id AND LOWER(dc.item_value)=LOWER(p.sub_solution))=1);
INSERT INTO migration_issues(project_id,area,reason,original_value,resolved,created_at)
SELECT p.id,'solutions','旧方案无法唯一匹配有效父子字典，请人工确认',CONCAT(COALESCE(p.solution,''),' / ',COALESCE(p.sub_solution,'')),FALSE,NOW(6)
FROM projects p WHERE (NULLIF(TRIM(p.solution),'') IS NOT NULL OR NULLIF(TRIM(p.sub_solution),'') IS NOT NULL)
AND NOT EXISTS(SELECT 1 FROM project_solutions ps WHERE ps.project_id=p.id);
