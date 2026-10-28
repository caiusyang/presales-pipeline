CREATE TABLE batch_jobs (
 id VARCHAR(36) NOT NULL PRIMARY KEY, request_key VARCHAR(128) NOT NULL UNIQUE,
 payload_hash VARCHAR(64) NOT NULL, kind VARCHAR(32) NOT NULL, status VARCHAR(32) NOT NULL,
 payload LONGTEXT NOT NULL, operator VARCHAR(255) NOT NULL, total INT NOT NULL DEFAULT 0,
 processed INT NOT NULL DEFAULT 0, succeeded INT NOT NULL DEFAULT 0, failed INT NOT NULL DEFAULT 0,
 error TEXT NULL, retry_key VARCHAR(128) NULL, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 KEY idx_batch_jobs_status (status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE batch_job_items (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, job_id VARCHAR(36) NOT NULL, item_index INT NOT NULL,
 weight INT NOT NULL DEFAULT 1, status VARCHAR(32) NOT NULL, input_data LONGTEXT NOT NULL,
 result_data LONGTEXT NULL, error TEXT NULL,
 UNIQUE KEY uk_batch_job_item (job_id,item_index), KEY idx_batch_item_state (job_id,status),
 CONSTRAINT fk_batch_item_job FOREIGN KEY (job_id) REFERENCES batch_jobs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
