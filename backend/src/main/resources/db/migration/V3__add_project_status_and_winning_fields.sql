ALTER TABLE projects
    ADD COLUMN project_status VARCHAR(32) NOT NULL DEFAULT '机会点识别' AFTER project_name,
    ADD COLUMN sub_solution VARCHAR(255) NULL AFTER solution,
    ADD COLUMN purchased_products JSON NULL AFTER sub_solution;

UPDATE projects SET purchased_products = JSON_ARRAY() WHERE purchased_products IS NULL;

ALTER TABLE projects MODIFY purchased_products JSON NOT NULL;

CREATE INDEX idx_projects_status_deleted ON projects (project_status, deleted);
