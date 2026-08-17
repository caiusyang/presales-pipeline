CREATE TABLE projects (
    id BIGINT NOT NULL AUTO_INCREMENT,
    external_id VARCHAR(128) NULL,
    customer_name VARCHAR(255) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    safety_space VARCHAR(255) NULL,
    solution VARCHAR(255) NULL,
    track VARCHAR(255) NULL,
    industry VARCHAR(255) NULL,
    sub_industry VARCHAR(255) NULL,
    scenario TEXT NULL,
    key_risks TEXT NULL,
    key_needs TEXT NULL,
    custom_fields JSON NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_projects_external_id (external_id),
    KEY idx_projects_customer_project_deleted (customer_name, project_name, deleted),
    KEY idx_projects_industry_track_deleted (industry, track, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE revenues (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    revenue_month CHAR(7) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_revenues_project_month (project_id, revenue_month),
    KEY idx_revenues_month_deleted (revenue_month, deleted),
    CONSTRAINT fk_revenues_project FOREIGN KEY (project_id) REFERENCES projects (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE progress_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    log_date DATE NOT NULL,
    content TEXT NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_progress_project_date (project_id, log_date DESC, deleted),
    CONSTRAINT fk_progress_project FOREIGN KEY (project_id) REFERENCES projects (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE dictionaries (
    id BIGINT NOT NULL AUTO_INCREMENT,
    type VARCHAR(64) NOT NULL,
    item_value VARCHAR(255) NOT NULL,
    parent_id BIGINT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_dictionaries_type_sort (type, deleted, sort_order),
    KEY idx_dictionaries_parent (parent_id, deleted),
    CONSTRAINT fk_dictionaries_parent FOREIGN KEY (parent_id) REFERENCES dictionaries (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE import_mappings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    column_map JSON NOT NULL,
    value_rules JSON NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_import_mappings_name_deleted (name, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE export_templates (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    scope VARCHAR(32) NOT NULL,
    columns JSON NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_export_templates_scope_name (scope, name, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE custom_field_definitions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    field_key VARCHAR(64) NOT NULL,
    label VARCHAR(255) NOT NULL,
    field_type VARCHAR(32) NOT NULL,
    required_field BOOLEAN NOT NULL DEFAULT FALSE,
    options_json JSON NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_custom_field_key (field_key),
    KEY idx_custom_fields_sort_deleted (deleted, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE change_logs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    operator VARCHAR(255) NOT NULL,
    field VARCHAR(128) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    source VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_change_logs_project_created (project_id, created_at DESC),
    CONSTRAINT fk_change_logs_project FOREIGN KEY (project_id) REFERENCES projects (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
