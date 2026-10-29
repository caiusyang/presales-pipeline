import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

/** Read-only restore preflight. Never connects to or changes a database. */
export function validateBackup(backup) {
  const errors = [], warnings = [], tables = { ...(backup?.tables ?? {}) }
  const required = ['projects', 'revenues', 'progress_logs', 'project_products', 'dictionaries', 'dictionary_categories', 'custom_field_definitions', 'import_mappings', 'export_templates', 'change_logs', 'product_catalog', 'project_solutions', 'responsible_people', 'project_responsibles', 'batch_jobs', 'batch_job_items', 'purged_project_snapshots', 'migration_issues']
  const sets = {}
  if (tables.follow_up_policies == null) warnings.push('旧备份未包含跟进规则，恢复时需补充固定靶 7 天、非固定靶 14 天的默认规则；不得重置项目跟进时间。')
  else {
    if (!Array.isArray(tables.follow_up_policies) || tables.follow_up_policies.length !== 1 || !tables.follow_up_policies[0] || tables.follow_up_policies[0].id !== 1 || !['fixedTargetDays', 'normalDays'].every((key) => Number.isInteger(tables.follow_up_policies[0][key]) && tables.follow_up_policies[0][key] >= 1 && tables.follow_up_policies[0][key] <= 3650)) errors.push('跟进规则必须有唯一 id=1，且周期为 1—3650 天的整数')
    if (Array.isArray(tables.follow_up_policies)) required.push('follow_up_policies')
  }
  for (const name of required) {
    if (!Array.isArray(tables[name])) { errors.push(`缺少表或不是数组：${name}`); tables[name] = []; continue }
    if (tables[name].some((row) => !row || typeof row !== 'object')) { errors.push(`${name} 包含非法记录`); tables[name] = tables[name].filter((row) => row && typeof row === 'object') }
    const ids = tables[name].map((r) => String(name === 'purged_project_snapshots' ? r.projectId : r.id))
    if (ids.includes('undefined') || ids.includes('null') || new Set(ids).size !== ids.length) errors.push(`${name} 主键缺失或重复`)
    sets[name] = new Set(ids)
  }
  const fk = (table, field, target, nullable = false) => {
    for (const row of tables[table]) if (!(nullable && row[field] == null) && !sets[target]?.has(String(row[field]))) errors.push(`${table}#${row.id} 的 ${field} 无有效 ${target} 引用`)
  }
  for (const table of ['revenues', 'progress_logs', 'project_products', 'change_logs', 'project_solutions', 'project_responsibles']) fk(table, 'projectId', 'projects')
  fk('migration_issues', 'projectId', 'projects', true)
  fk('project_solutions', 'solutionId', 'dictionaries'); fk('project_solutions', 'subSolutionId', 'dictionaries', true)
  fk('project_responsibles', 'personId', 'responsible_people'); fk('batch_job_items', 'jobId', 'batch_jobs')
  const codes = new Set(tables.product_catalog.map((r) => r.code)), dictionaries = new Map(tables.dictionaries.map((r) => [String(r.id), r]))
  for (const row of tables.project_products) if (!codes.has(row.productCode)) errors.push(`project_products#${row.id} 产品编码不存在`)
  for (const row of tables.project_solutions) {
    const parent = dictionaries.get(String(row.solutionId)), child = dictionaries.get(String(row.subSolutionId))
    if (parent?.type !== 'solution' || row.subSolutionId != null && (child?.type !== 'sub_solution' || String(child.parentId) !== String(row.solutionId))) errors.push(`project_solutions#${row.id} 方案父子关系错误`)
  }
  for (const row of tables.purged_project_snapshots) if (sets.projects?.has(String(row.projectId))) errors.push(`永久删除标记与现存项目冲突：${row.projectId}`)
  for (const row of tables.revenues) if (!Number.isFinite(Number(row.amount)) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)) errors.push(`revenues#${row.id} 金额或月份无效`)
  for (const row of tables.projects) {
    if (row.fixedTarget != null && typeof row.fixedTarget !== 'boolean') errors.push(`projects#${row.id} 是否固定靶必须为布尔值`)
    if (row.projectLevel && !['无风险', '低风险', '高风险'].includes(row.projectLevel)) errors.push(`projects#${row.id} 项目级别无效`)
  }
  for (const rule of Array.isArray(tables.follow_up_policies) ? tables.follow_up_policies : []) {
    if (!rule?.fieldKey && rule?.defaultDays == null && rule?.rules == null) continue // V15 backups still restore via migration.
    const supported = ['fixedTarget', 'projectLevel', 'projectStatus', 'track', 'industry', 'subIndustry', 'securityDirection', 'hcsStatus']
    const custom = tables.custom_field_definitions.find((f) => !f.deleted && `custom.${f.fieldKey}` === rule.fieldKey && ['text', 'option'].includes(f.fieldType))
    if (!supported.includes(rule.fieldKey) && !custom) errors.push('跟进规则关联字段不存在或类型不受支持')
    const validDays = (n) => Number.isInteger(n) && n >= 1 && n <= 3650
    if (!validDays(rule.defaultDays) || !Array.isArray(rule.rules) || rule.rules.length > 100 || rule.rules.some((r) => !r || typeof r.value !== 'string' || !r.value.trim() || r.value.trim().length > 255 || !validDays(r.days))) errors.push('跟进字段值规则或默认周期无效')
    else if (new Set(rule.rules.map((r) => r.value.trim().toLowerCase())).size !== rule.rules.length) errors.push('跟进字段值规则重复')
  }
  for (const [table, fields] of [['batch_jobs', ['payload']], ['batch_job_items', ['inputData', 'resultData']]]) for (const row of tables[table]) for (const field of fields) if (row[field] != null) try { JSON.parse(row[field]) } catch { errors.push(`${table}#${row.id} ${field} 不是有效 JSON`) }
  const incomeCents = tables.revenues.filter((r) => !r.deleted).reduce((n, r) => n + Math.round(Number(r.amount) * 100), 0)
  return { valid: errors.length === 0, errors, warnings, counts: Object.fromEntries(required.map((name) => [name, tables[name].length])), activeRevenueTotal: (incomeCents / 100).toFixed(2), note: '只做备份结构与引用校验，不执行恢复；仍须在隔离 MySQL 恢复并核对记录数、方案、产品及收入。' }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('用法：node scripts/validate-backup.mjs /绝对路径/backup.json')
  const report = validateBackup(JSON.parse(await fs.readFile(process.argv[2], 'utf8')))
  console.log(JSON.stringify(report, null, 2)); process.exitCode = report.valid ? 0 : 1
}
