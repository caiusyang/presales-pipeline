import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DictNode } from '@/types'
import { applyEdits, emptyReview, excludeImportRows, isPendingImportRow, localImportIssues, mappingRule, mergeImportFields, optionsForField, pendingImportRecords, recordsForPreflight, validateImportRecord } from './importReview'
import { buildImportRecords, draftsToRules, rulesToDrafts } from './importTransform'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
const record = { sourceRow: 9, fields: { customerName: '客户', projectName: '项目' }, revenues: [], progress: [] }
const dictionaries: DictNode[] = [
  { id: 1, type: 'solution', value: '方案甲', parentId: null, sortOrder: 0 },
  { id: 2, type: 'solution', value: '方案乙', parentId: null, sortOrder: 0 },
  { id: 3, type: 'sub_solution', value: '同名细分', parentId: 1, sortOrder: 0 },
  { id: 4, type: 'sub_solution', value: '同名细分', parentId: 2, sortOrder: 0 },
  { id: 5, type: 'product', value: 'WAF', parentId: 3, sortOrder: 0 },
  { id: 6, type: 'product', value: 'HSS', parentId: 4, sortOrder: 0 },
]

describe('导入问题修正', () => {
  it('成功和移除的行不再参与列表及导入，恢复仅找回未导入行并保留修正', () => {
    const records = [7, 9, 12].map((sourceRow) => ({ ...record, sourceRow }))
    const session = emptyReview()
    session.completed[7] = { row: 1, sourceRow: 7, status: 'added' }
    session.edits[9] = { customerName: '修正后的客户' }
    const excluded = excludeImportRows(session, [7, 9])
    expect(pendingImportRecords(records, excluded).map((row) => row.sourceRow)).toEqual([12])
    expect(isPendingImportRow(excluded, 7)).toBe(false)
    expect(isPendingImportRow(excluded, 9)).toBe(false)
    expect(excluded.excluded).toEqual({ 9: true })
    expect(session.excluded).toEqual({})
    const restored = { ...excluded, excluded: {} }
    expect(pendingImportRecords(records, restored).map((row) => row.sourceRow)).toEqual([9, 12])
    expect(restored.edits[9].customerName).toBe('修正后的客户')
  })
  it('批量移除不会覆盖已有项目或为移除行创建字段，未处理行仍可继续导入', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    const { mockApi } = await import('@/api/mock')
    const original = { ...record, sourceRow: 2, fields: { externalId: 'EXCLUDE-TEST', customerName: '移除测试客户', projectName: '保留已有项目' } }
    const first = await mockApi.importRecords({ dryRun: false, records: [original] })
    const projectId = first.details[0].projectId!
    const before = await mockApi.getProjectDetail(projectId)
    const session = emptyReview()
    session.completed[2] = first.details[0]
    const pendingFields = [{ fieldKey: 'excluded_only', label: '不应创建的字段', fieldType: 'text' as const }]
    const excludedUpdate = { ...record, sourceRow: 3, fields: { externalId: 'EXCLUDE-TEST', projectName: '不应覆盖的名称', customFields: { excluded_only: '不导入' } } }
    const valid = { ...record, sourceRow: 4, fields: { customerName: '继续导入客户', projectName: '继续导入项目' } }
    const invalid = { ...record, sourceRow: 5, fields: { projectName: '仍待补齐客户' } }
    const excluded = excludeImportRows(session, [3])
    const remaining = pendingImportRecords([original, excludedUpdate, valid, invalid], excluded)
    expect(remaining.map((row) => row.sourceRow)).toEqual([4, 5])
    const preview = await mockApi.importRecords({ dryRun: true, records: remaining, pendingFields })
    expect(preview.added).toBe(1); expect(preview.skipped).toBe(1)
    const acceptedRows = new Set(preview.details.filter((row) => row.status === 'added').map((row) => row.sourceRow))
    const executed = await mockApi.importRecords({ dryRun: false, records: remaining.filter((row) => acceptedRows.has(row.sourceRow)), pendingFields })
    executed.details.forEach((row) => { excluded.completed[row.sourceRow!] = row })
    expect(pendingImportRecords([original, excludedUpdate, valid, invalid], excluded).map((row) => row.sourceRow)).toEqual([5])
    expect(await mockApi.getProjectDetail(projectId)).toEqual(before)
    expect((await mockApi.listCustomFields()).some((field) => field.fieldKey === 'excluded_only')).toBe(false)
  })
  it('未配置子行业字典时与正式后端一样允许自由文本', () => {
    expect(optionsForField('subIndustry', { industry: '行业' }, [], [])).toBeNull()
    expect(validateImportRecord({ ...record, fields: { ...record.fields, subIndustry: '自有分类' } }, [], [])).toEqual([])
  })
  it('前端解析失败行不占用后端判重，修正金额后可重新参与预检', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    const { mockApi } = await import('@/api/mock')
    const transformed = buildImportRecords({ headers: ['客户', '项目', '收入'], rows: [['回归客户', '回归项目', '待确认'], ['回归客户', '回归项目', '10']], columnMap: { 客户: 'customerName', 项目: 'projectName', 收入: 'revenue:2026-10' }, valueRules: [], today: '2026-10-10', dataStartRow: 2 })
    const records = recordsForPreflight(transformed.records, transformed.problems)
    expect(records.map((row) => row.sourceRow)).toEqual([3])
    const result = await mockApi.importRecords({ dryRun: true, records })
    expect(result.added).toBe(1)
    expect(result.skipped).toBe(0)
    expect(recordsForPreflight([transformed.records[0]], transformed.problems)).toEqual([])
    const budgetProblem = [{ excelRow: 9, field: 'securityBudget', message: '金额非法' }]
    expect(localImportIssues(applyEdits(record, { securityBudget: 12 }), budgetProblem)).toEqual([])
    expect(localImportIssues(applyEdits(record, { securityBudget: -1 }), budgetProblem)).toHaveLength(1)
  })
  it('一次显示缺客户、非标准状态、金额和待新增字段格式问题', () => {
    const issues = validateImportRecord({ ...record, fields: { projectName: '项目', projectStatus: '洽谈' as never, securityBudget: -1, customFields: { next_date: '2026-02-30' } } }, [], [], [
      { fieldKey: 'next_date', label: '下次拜访', fieldType: 'date' },
    ])
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(['customerName', 'projectStatus', 'securityBudget', 'custom.next_date']))
  })
  it('客户缺失的更新先合并已有项目；显式清空仍报错', () => {
    const fields = mergeImportFields({ externalId: 'A' }, { ...record.fields, projectStatus: '方案设计', customFields: { note: '旧值' } })
    expect(validateImportRecord({ ...record, fields }, [], [{ id: 1, fieldKey: 'note', label: '备注', fieldType: 'text', required: false, options: [], sortOrder: 0 }])).toEqual([])
    expect(mergeImportFields({ customerName: '' }, fields).customerName).toBe('')
  })
  it('标准值规则保存后可复用，并保留父级上下文与单行修正优先级', () => {
    const rules = [mappingRule('projectStatus', '沟通', '方案引导', {}), mappingRule('subSolution', '旧细分', '同名细分', { solution: '方案甲' })]
    expect(draftsToRules(rulesToDrafts(rules))).toEqual(rules)
    const result = buildImportRecords({
      headers: ['客户', '项目', '状态', '方案', '细分'], rows: [['甲', 'A', '沟通', '方案甲', '旧细分'], ['乙', 'B', '沟通', '方案乙', '旧细分']],
      columnMap: { 客户: 'customerName', 项目: 'projectName', 状态: 'projectStatus', 方案: 'solution', 细分: 'subSolution' },
      valueRules: rules, today: '2026-10-10', dataStartRow: 4,
    })
    expect(result.records.map((r) => r.sourceRow)).toEqual([4, 5])
    expect(result.records[0].fields.subSolution).toBe('同名细分')
    expect(result.records[1].fields.subSolution).toBe('旧细分')
    const corrected = applyEdits(applyEdits(result.records[0], { customerName: '批量客户' }), { customerName: '单行客户' })
    expect(corrected.fields.customerName).toBe('单行客户')
    expect(corrected.fields.projectStatus).toBe('方案引导')
  })
  it('已购产品独立于方案推荐产品，切换方案不拒绝拥有记录', () => {
    expect(optionsForField('purchasedProducts', { solution: '方案甲', subSolution: '同名细分' }, dictionaries, [])).toEqual(expect.arrayContaining(['WAF', 'HSS']))
    const issues = validateImportRecord({ ...record, fields: { ...record.fields, solution: '方案甲', subSolution: '同名细分', purchasedProducts: ['HSS'] } }, dictionaries, [])
    expect(issues.some((i) => i.field === 'purchasedProducts')).toBe(false)
  })
  it('中标缺项及收入和进展格式问题均参与预检', () => {
    const issues = validateImportRecord({ ...record, fields: { ...record.fields, projectStatus: '中标' }, revenues: [{ month: '2026-13', amount: -1 }], progress: [{ logDate: '2026-02-30', content: '' }] }, [], [])
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(['solution', 'subSolution', 'purchasedProducts', 'revenues.0', 'progress.0']))
  })
  it('无效收入和进展保留本地阻断问题，不能静默丢弃', () => {
    const result = buildImportRecords({ headers: ['客户', '项目', '收入', '进展'], rows: [['甲', 'A', '待确认', '2026-02-30：无效日期']], columnMap: { 客户: 'customerName', 项目: 'projectName', 收入: 'revenue:2026-10', 进展: 'progressText' }, valueRules: [], today: '2026-10-10', dataStartRow: 7 })
    expect(result.problems.map((p) => [p.excelRow, p.field])).toEqual([[7, 'source:2'], [7, 'source:3']])
  })

  it('演示预检不写入，失败首行不占用判重，分批导入后可以沿用已有客户', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    const { mockApi } = await import('@/api/mock')
    const before = await mockApi.backupAll()
    const pendingFields = [{ fieldKey: 'import_extra', label: '新增备注', fieldType: 'text' as const }]
    const invalid = { ...record, sourceRow: 6, fields: { externalId: 'REVIEW-X', projectName: '新项目', projectStatus: '洽谈' as never } }
    const valid = { ...record, sourceRow: 7, fields: { externalId: 'REVIEW-X', customerName: '新客户', projectName: '新项目', customFields: { import_extra: '内容' } } }
    const preview = await mockApi.importRecords({ dryRun: true, records: [invalid, valid], pendingFields })
    expect(preview.added).toBe(1); expect(preview.skipped).toBe(1)
    expect(preview.details[0].issues?.length).toBeGreaterThanOrEqual(2)
    // 备份的时间戳不作为数据判断依据。
    expect(await mockApi.listCustomFields()).not.toEqual(expect.arrayContaining([expect.objectContaining({ fieldKey: 'import_extra' })]))
    const after = await mockApi.backupAll()
    expect(JSON.stringify(after).replace(/"generatedAt":"[^"]+"/g, '')).toBe(JSON.stringify(before).replace(/"generatedAt":"[^"]+"/g, ''))
    const executed = await mockApi.importRecords({ dryRun: false, records: [valid], pendingFields })
    expect(executed.added).toBe(1)
    const update = await mockApi.importRecords({ dryRun: true, records: [{ ...record, sourceRow: 6, fields: { externalId: 'REVIEW-X', projectStatus: '方案引导' } }] })
    expect(update.overwritten).toBe(1)
    expect(update.details[0].effectiveFields?.customerName).toBe('新客户')
    expect(update.details[0].sourceRow).toBe(6)
  })
})
