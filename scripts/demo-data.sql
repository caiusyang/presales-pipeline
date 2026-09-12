INSERT INTO projects (
    external_id, customer_name, project_name, project_status, safety_space, solution, purchased_products, track,
    industry, sub_industry, scenario, key_risks, key_needs, custom_fields,
    deleted, created_at, updated_at
)
SELECT 'DEMO-001', '华东示例银行', '数据安全治理一期', '机会点识别', '数据域', '安全咨询', JSON_ARRAY(), '数据安全',
       '金融', '银行', '核心数据分级分类与流转治理', '跨部门数据口径尚未统一',
       '完成现状调研并形成分阶段建设路线', JSON_OBJECT(), FALSE, NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE external_id = 'DEMO-001');

INSERT INTO projects (
    external_id, customer_name, project_name, project_status, safety_space, solution, purchased_products, track,
    industry, sub_industry, scenario, key_risks, key_needs, custom_fields,
    deleted, created_at, updated_at
)
SELECT 'DEMO-002', '滨海市政务云', '云安全运营平台', '机会点识别', '云域', '运营服务', JSON_ARRAY(), '云安全',
       '政府', '政务', '政务云统一安全运营', '存量系统接口差异较大',
       '先完成重点系统接入验证', JSON_OBJECT(), FALSE, NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE external_id = 'DEMO-002');

INSERT INTO revenues (project_id, revenue_month, amount, deleted, created_at, updated_at)
SELECT id, '2026-08', 120.00, FALSE, NOW(6), NOW(6)
FROM projects WHERE external_id = 'DEMO-001'
ON DUPLICATE KEY UPDATE amount = VALUES(amount), deleted = FALSE, updated_at = NOW(6);

INSERT INTO revenues (project_id, revenue_month, amount, deleted, created_at, updated_at)
SELECT id, '2026-09', 80.00, FALSE, NOW(6), NOW(6)
FROM projects WHERE external_id = 'DEMO-001'
ON DUPLICATE KEY UPDATE amount = VALUES(amount), deleted = FALSE, updated_at = NOW(6);

INSERT INTO revenues (project_id, revenue_month, amount, deleted, created_at, updated_at)
SELECT id, '2026-10', 200.00, FALSE, NOW(6), NOW(6)
FROM projects WHERE external_id = 'DEMO-002'
ON DUPLICATE KEY UPDATE amount = VALUES(amount), deleted = FALSE, updated_at = NOW(6);

INSERT INTO progress_logs (project_id, log_date, content, deleted, created_at, updated_at)
SELECT id, '2026-08-15', '完成首次需求访谈，等待客户确认调研范围', FALSE, NOW(6), NOW(6)
FROM projects p
WHERE p.external_id = 'DEMO-001'
  AND NOT EXISTS (
      SELECT 1 FROM progress_logs l
      WHERE l.project_id = p.id AND l.log_date = '2026-08-15'
        AND l.content = '完成首次需求访谈，等待客户确认调研范围' AND l.deleted = FALSE
  );

INSERT INTO export_templates (name, scope, columns, deleted, created_at, updated_at)
SELECT '领导总表', 'projects',
       JSON_ARRAY(
           JSON_OBJECT('key', 'externalId', 'title', '项目编号'),
           JSON_OBJECT('key', 'customerName', 'title', '客户名称'),
           JSON_OBJECT('key', 'projectName', 'title', '项目名称'),
           JSON_OBJECT('key', 'industry', 'title', '行业'),
           JSON_OBJECT('key', 'revenueTotal', 'title', '收入合计（万元）')
       ), FALSE, NOW(6), NOW(6)
WHERE NOT EXISTS (
    SELECT 1 FROM export_templates WHERE name = '领导总表' AND scope = 'projects' AND deleted = FALSE
);
