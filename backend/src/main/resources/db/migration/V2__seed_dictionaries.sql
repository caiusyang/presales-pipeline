INSERT INTO dictionaries (type, item_value, parent_id, sort_order, deleted, created_at, updated_at)
VALUES
    ('track', '数据安全', NULL, 10, FALSE, NOW(6), NOW(6)),
    ('track', '云安全', NULL, 20, FALSE, NOW(6), NOW(6)),
    ('track', '网络安全', NULL, 30, FALSE, NOW(6), NOW(6)),
    ('solution', '安全咨询', NULL, 10, FALSE, NOW(6), NOW(6)),
    ('solution', '平台建设', NULL, 20, FALSE, NOW(6), NOW(6)),
    ('solution', '运营服务', NULL, 30, FALSE, NOW(6), NOW(6)),
    ('industry', '金融', NULL, 10, FALSE, NOW(6), NOW(6)),
    ('industry', '政府', NULL, 20, FALSE, NOW(6), NOW(6)),
    ('industry', '制造', NULL, 30, FALSE, NOW(6), NOW(6));

INSERT INTO dictionaries (type, item_value, parent_id, sort_order, deleted, created_at, updated_at)
SELECT 'sub_industry', '银行', id, 10, FALSE, NOW(6), NOW(6)
FROM dictionaries WHERE type = 'industry' AND item_value = '金融';

INSERT INTO dictionaries (type, item_value, parent_id, sort_order, deleted, created_at, updated_at)
SELECT 'sub_industry', '保险', id, 20, FALSE, NOW(6), NOW(6)
FROM dictionaries WHERE type = 'industry' AND item_value = '金融';

INSERT INTO dictionaries (type, item_value, parent_id, sort_order, deleted, created_at, updated_at)
SELECT 'sub_industry', '政务', id, 10, FALSE, NOW(6), NOW(6)
FROM dictionaries WHERE type = 'industry' AND item_value = '政府';
