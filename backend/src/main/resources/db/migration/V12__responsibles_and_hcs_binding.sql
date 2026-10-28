CREATE TABLE responsible_people (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,
 employee_no VARCHAR(128) NULL UNIQUE,account VARCHAR(128) NULL UNIQUE,aliases JSON NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,created_at DATETIME(6) NOT NULL,updated_at DATETIME(6) NOT NULL
);
CREATE TABLE project_responsibles (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,project_id BIGINT NOT NULL,person_id BIGINT NOT NULL,
 source VARCHAR(16) NOT NULL,role VARCHAR(255) NULL,created_at DATETIME(6) NOT NULL,updated_at DATETIME(6) NOT NULL,
 UNIQUE KEY uq_project_responsible (project_id,person_id,source),
 CONSTRAINT fk_project_responsible_project FOREIGN KEY (project_id) REFERENCES projects(id),
 CONSTRAINT fk_project_responsible_person FOREIGN KEY (person_id) REFERENCES responsible_people(id)
);
ALTER TABLE projects ADD COLUMN hcs_opportunity_id VARCHAR(128) NULL UNIQUE,
 ADD COLUMN hcs_status VARCHAR(255) NULL, ADD COLUMN last_sync_at DATETIME(6) NULL;
-- Never infer HCS bindings from generic external IDs, names or security directions.
