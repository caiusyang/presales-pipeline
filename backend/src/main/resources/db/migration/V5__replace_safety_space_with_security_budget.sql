ALTER TABLE projects
    DROP COLUMN safety_space,
    ADD COLUMN security_budget DECIMAL(18, 2) NULL AFTER project_status;
