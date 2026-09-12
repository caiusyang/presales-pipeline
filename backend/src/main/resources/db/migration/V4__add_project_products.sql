CREATE TABLE project_products (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    product_code VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_project_products_project_code (project_id, product_code),
    KEY idx_project_products_code (product_code),
    CONSTRAINT fk_project_products_project FOREIGN KEY (project_id) REFERENCES projects (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 兼容既有 purchased_products JSON 数据：应用启动时由 ProjectDataInitializer
-- 逐项目同步到本关系表，避免依赖不同数据库的 JSON 展开函数。
