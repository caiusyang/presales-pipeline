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
