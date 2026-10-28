import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

/** Read-only restore preflight. Never connects to or changes a database. */
export function validateBackup(backup) {
  const errors = [], tables = { ...(backup?.tables ?? {}) }
  const required = ['projects', 'revenues', 'progress_logs', 'project_products', 'dictionaries', 'dictionary_categories', 'custom_field_definitions', 'import_mappings', 'export_templates', 'change_logs', 'product_catalog', 'project_solutions', 'responsible_people', 'project_responsibles', 'batch_jobs', 'batch_job_items', 'purged_project_snapshots', 'migration_issues']
  const sets = {}
  for (const name of required) {
    if (!Array.isArray(tables[name])) { errors.push(`缺少表或不是数组：${name}`); tables[name] = []; continue }
    const ids = tables[name].map((r) => String(name === 'purged_project_snapshots' ? r.projectId : r.id))
    if (ids.includes('undefined') || ids.includes('null') || new Set(ids).size !== ids.length) errors.push(`${name} 主键缺失或重复`)
    sets[name] = new Set(ids)
  }
  const fk = (table, field, target, nullable = false) => {
    for (const row of tables[table]) if (!(nullable && row[field] == null) && !sets[target]?.has(String(row[field]))) errors.push(`${table}#${row.id} 的 ${field} 无有效 ${target} 引用`)
  }
  for (const table of ['revenues', 'progress_logs', 'project_products', 'change_logs', 'project_solutions', 'project_responsibles', 'migration_issues']) fk(table, 'projectId', 'projects')
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
  for (const [table, fields] of [['batch_jobs', ['payload']], ['batch_job_items', ['inputData', 'resultData']]]) for (const row of tables[table]) for (const field of fields) if (row[field] != null) try { JSON.parse(row[field]) } catch { errors.push(`${table}#${row.id} ${field} 不是有效 JSON`) }
  const incomeCents = tables.revenues.filter((r) => !r.deleted).reduce((n, r) => n + Math.round(Number(r.amount) * 100), 0)
  return { valid: errors.length === 0, errors, counts: Object.fromEntries(required.map((name) => [name, tables[name].length])), activeRevenueTotal: (incomeCents / 100).toFixed(2), note: '只做备份结构与引用校验，不执行恢复；仍须在隔离 MySQL 恢复并核对记录数、方案、产品及收入。' }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('用法：node scripts/validate-backup.mjs /绝对路径/backup.json')
  const report = validateBackup(JSON.parse(await fs.readFile(process.argv[2], 'utf8')))
  console.log(JSON.stringify(report, null, 2)); process.exitCode = report.valid ? 0 : 1
}
