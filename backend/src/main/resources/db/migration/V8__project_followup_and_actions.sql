ALTER TABLE projects ADD COLUMN last_follow_up_at DATETIME(6) NULL,
 ADD COLUMN next_action_date DATE NULL, ADD COLUMN next_action_note TEXT NULL,
 ADD KEY idx_projects_next_action (deleted,next_action_date,id);
UPDATE projects p SET last_follow_up_at=GREATEST(
 p.created_at,
 COALESCE((SELECT MAX(c.created_at) FROM change_logs c WHERE c.project_id=p.id AND c.field NOT IN ('deleted','lastSyncAt')),p.created_at),
 COALESCE((SELECT MAX(g.updated_at) FROM progress_logs g WHERE g.project_id=p.id),p.created_at),
 COALESCE((SELECT MAX(r.updated_at) FROM revenues r WHERE r.project_id=p.id),p.created_at),
 COALESCE((SELECT MAX(x.updated_at) FROM project_products x WHERE x.project_id=p.id),p.created_at)
);
