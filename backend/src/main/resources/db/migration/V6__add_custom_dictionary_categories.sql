CREATE TABLE dictionary_categories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    type VARCHAR(64) NOT NULL,
    label VARCHAR(255) NOT NULL,
    built_in BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_dictionary_categories_type (type),
    KEY idx_dictionary_categories_sort (deleted, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO dictionary_categories (type, label, built_in, sort_order, deleted, created_at, updated_at)
VALUES ('track', '赛道', TRUE, 10, FALSE, NOW(6), NOW(6)),
       ('industry', '行业', TRUE, 20, FALSE, NOW(6), NOW(6)),
       ('solution', '解决方案', TRUE, 30, FALSE, NOW(6), NOW(6));

INSERT INTO dictionary_categories (type, label, built_in, sort_order, deleted, created_at, updated_at)
SELECT DISTINCT type, type, FALSE, 100, FALSE, NOW(6), NOW(6)
FROM dictionaries
WHERE type NOT IN ('track', 'industry', 'solution', 'sub_industry', 'sub_solution', 'product');

ALTER TABLE custom_field_definitions ADD COLUMN dictionary_type VARCHAR(64) NULL;
