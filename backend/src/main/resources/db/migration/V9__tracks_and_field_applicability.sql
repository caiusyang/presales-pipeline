CREATE TABLE migration_issues (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, project_id BIGINT NULL, area VARCHAR(64) NOT NULL,
 reason TEXT NOT NULL, original_value TEXT NULL, resolved BOOLEAN NOT NULL DEFAULT FALSE, created_at DATETIME(6) NOT NULL,
 KEY idx_migration_project (project_id,area), CONSTRAINT fk_migration_project FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE projects ADD COLUMN security_direction VARCHAR(255) NULL;
INSERT INTO migration_issues(project_id,area,reason,original_value,created_at)
SELECT id,'track','旧值是安全方向，无法据此确定 HCS/公有云；请人工分类',track,NOW(6) FROM projects WHERE track IS NOT NULL AND TRIM(track)<>'' AND track NOT IN ('HCS','公有云');
UPDATE projects SET security_direction=track,track=NULL WHERE track IS NOT NULL AND TRIM(track)<>'' AND track NOT IN ('HCS','公有云');
UPDATE dictionaries SET type='security_direction' WHERE type='track' AND item_value NOT IN ('HCS','公有云');
INSERT INTO dictionaries(type,item_value,parent_id,sort_order,deleted,created_at,updated_at)
SELECT 'track','HCS',NULL,10,FALSE,NOW(6),NOW(6) WHERE NOT EXISTS(SELECT 1 FROM dictionaries WHERE type='track' AND item_value='HCS' AND deleted=FALSE);
INSERT INTO dictionaries(type,item_value,parent_id,sort_order,deleted,created_at,updated_at)
SELECT 'track','公有云',NULL,20,FALSE,NOW(6),NOW(6) WHERE NOT EXISTS(SELECT 1 FROM dictionaries WHERE type='track' AND item_value='公有云' AND deleted=FALSE);
INSERT INTO dictionary_categories(type,label,built_in,sort_order,deleted,created_at,updated_at)
SELECT 'security_direction','安全方向',TRUE,40,FALSE,NOW(6),NOW(6) WHERE NOT EXISTS(SELECT 1 FROM dictionary_categories WHERE type='security_direction');
ALTER TABLE custom_field_definitions ADD COLUMN applicable_tracks JSON NULL;
UPDATE custom_field_definitions SET applicable_tracks=JSON_ARRAY();
ALTER TABLE import_mappings ADD COLUMN applicable_track VARCHAR(16) NULL;
ALTER TABLE export_templates ADD COLUMN applicable_track VARCHAR(16) NULL;
