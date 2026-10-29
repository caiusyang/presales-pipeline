ALTER TABLE projects ADD COLUMN fixed_target BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN project_level VARCHAR(16) NULL;
CREATE TABLE follow_up_policies (
 id BIGINT NOT NULL PRIMARY KEY,
 fixed_target_days INT NOT NULL,
 normal_days INT NOT NULL,
 updated_at DATETIME(6) NOT NULL
);
INSERT INTO follow_up_policies(id,fixed_target_days,normal_days,updated_at) VALUES(1,7,14,NOW(6));
