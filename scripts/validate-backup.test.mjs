import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateBackup } from './validate-backup.mjs'
const names = ['projects','revenues','progress_logs','project_products','dictionaries','dictionary_categories','custom_field_definitions','import_mappings','export_templates','change_logs','product_catalog','project_solutions','responsible_people','project_responsibles','batch_jobs','batch_job_items','purged_project_snapshots','migration_issues']
test('恢复预检核对新增关联、产品、任务以及收入，识别孤儿引用和损坏快照', () => {
  const backup = { tables: Object.fromEntries(names.map((name) => [name, []])) }
  Object.assign(backup.tables, { projects: [{ id:1 }], revenues: [{ id:1, projectId:1, month:'2026-01', amount:10.25 }], product_catalog:[{ id:1, code:'WAF' }], project_products:[{ id:1, projectId:1, productCode:'WAF' }], dictionaries:[{ id:1, type:'solution' },{ id:2, type:'sub_solution',parentId:1 }], project_solutions:[{ id:1, projectId:1, solutionId:1, subSolutionId:2 }], batch_jobs:[{ id:'job',payload:'{}' }], batch_job_items:[{ id:1, jobId:'job', inputData:'{}', resultData:null }] })
  assert.equal(validateBackup(backup).valid, true); assert.equal(validateBackup(backup).activeRevenueTotal, '10.25')
  backup.tables.project_solutions[0].projectId=99; backup.tables.batch_job_items[0].resultData='broken'
  const report=validateBackup(backup); assert.equal(report.valid,false); assert.ok(report.errors.some((s)=>s.includes('引用'))); assert.ok(report.errors.some((s)=>s.includes('有效 JSON')))
})
test('跟进规则与项目级别校验；旧备份可预检但明确提示补规则', () => {
  const backup = { tables: Object.fromEntries(names.map((name) => [name, []])) }
  assert.equal(validateBackup(backup).valid, true)
  assert.equal(validateBackup(backup).warnings.length, 1)
  backup.tables.follow_up_policies = [{ id:1, fixedTargetDays:7, normalDays:14 }]
  backup.tables.projects = [{ id:1, fixedTarget:true, projectLevel:'高风险' }]
  assert.equal(validateBackup(backup).valid, true)
  assert.equal(validateBackup(backup).warnings.length, 0)
  backup.tables.follow_up_policies[0].normalDays = 0
  backup.tables.projects[0].fixedTarget = '是'
  backup.tables.projects[0].projectLevel = '重点'
  assert.equal(validateBackup(backup).errors.length, 3)
})
test('自定义字段关联规则的备份能预检，拒绝丢失字段、重复值和非法周期', () => {
  const backup = { tables: Object.fromEntries(names.map((name) => [name, []])) }
  backup.tables.custom_field_definitions = [{ id:1, fieldKey:'follow_class', fieldType:'text', deleted:false }]
  backup.tables.follow_up_policies = [{ id:1, fixedTargetDays:7, normalDays:14, fieldKey:'custom.follow_class', defaultDays:14, rules:[{ value:'VIP', days:3 }] }]
  assert.equal(validateBackup(backup).valid, true)
  backup.tables.follow_up_policies[0].rules.push({ value:'vip', days:7 })
  assert.ok(validateBackup(backup).errors.some((s) => s.includes('重复')))
  backup.tables.custom_field_definitions[0].deleted = true
  assert.ok(validateBackup(backup).errors.some((s) => s.includes('关联字段')))
  backup.tables.follow_up_policies = {}
  assert.equal(validateBackup(backup).valid, false)
  backup.tables.follow_up_policies = [null]
  assert.equal(validateBackup(backup).valid, false)
})
