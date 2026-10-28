import type { CustomFieldDef, DictNode, ProjectInput, ValueRule } from '@/types'
import { PROJECT_STATUSES } from '@/types'
import type { ImportFieldDefinition, ImportIssue, ImportRecordInput, ImportRecordResult } from '@/api/types'
import { PROJECT_FIELD_LABELS, appliesToTrack } from '@/lib/fields'
import { normalizeProductCode, productDefinitions } from '@/lib/products'
import { validateSecurityBudget } from '@/components/project/project-utils'
import { isValidMonth } from '@/lib/format'
import { normalizeDateValue } from './importTransform'
import type { TransformProblem } from './importTransform'
import { solutionSelections, normalizeSolutions, withSolutions } from '@/lib/solutions'
import type { Project, SolutionSelection } from '@/types'

export type FieldEdits = Record<string, unknown>
export interface ReviewSession {
  bulk: Record<number, FieldEdits>
  edits: Record<number, FieldEdits>
  cells: Record<number, Record<number, string>>
  rules: ValueRule[]
  completed: Record<number, ImportRecordResult>
  excluded: Record<number, true>
}
export const emptyReview = (): ReviewSession => ({ bulk: {}, edits: {}, cells: {}, rules: [], completed: {}, excluded: {} })

export const isPendingImportRow = (session: ReviewSession, sourceRow: number): boolean =>
  !session.completed[sourceRow] && !session.excluded[sourceRow]

export function pendingImportRecords(records: ImportRecordInput[], session: ReviewSession): ImportRecordInput[] {
  return records.filter((record) => record.sourceRow != null && isPendingImportRow(session, record.sourceRow))
}

/** 仅移出当前导入会话，保留原始数据与修正，供用户恢复。 */
export function excludeImportRows(session: ReviewSession, sourceRows: number[]): ReviewSession {
  const excluded = { ...session.excluded }
  for (const sourceRow of sourceRows) if (!session.completed[sourceRow]) excluded[sourceRow] = true
  return { ...session, excluded }
}
export const valueText = (value: unknown): string => Array.isArray(value) ? value.some((v) => typeof v === 'object') ? JSON.stringify(value) : value.join('、') : String(value ?? '').trim()
export const fieldValue = (fields: Partial<ProjectInput>, key: string): unknown => key.startsWith('custom.')
  ? fields.customFields?.[key.slice(7)] : (fields as Record<string, unknown>)[key]
export const fieldLabel = (key: string, defs: CustomFieldDef[]) => key.startsWith('custom.')
  ? defs.find((d) => d.fieldKey === key.slice(7))?.label ?? key.slice(7) : PROJECT_FIELD_LABELS[key] ?? key

/** 无法序列化为有效收入/日期的行先留在本地，不能占用服务端批内判重标识。 */
export function localImportIssues(record: ImportRecordInput, problems: TransformProblem[]): ImportIssue[] {
  return problems.filter((problem) => problem.excelRow === record.sourceRow
    && !(problem.field === 'securityBudget' && !validateSecurityBudget(record.fields.securityBudget)))
    .map((problem) => ({ field: problem.field ?? '_record', code: 'format', message: problem.message }))
}

export function recordsForPreflight(records: ImportRecordInput[], problems: TransformProblem[]): ImportRecordInput[] {
  return records.filter((record) => !localImportIssues(record, problems).length)
}

export function applyEdits(record: ImportRecordInput, edits: FieldEdits = {}): ImportRecordInput {
  const fields = { ...record.fields, customFields: { ...record.fields.customFields } }
  for (const [key, value] of Object.entries(edits)) {
    if (key.startsWith('custom.')) fields.customFields[key.slice(7)] = value
    else (fields as Record<string, unknown>)[key] = key === 'purchasedProducts' ? productValues(value) : value
  }
  if (Object.hasOwn(edits, 'solutions') && Array.isArray(fields.solutions)) return { ...record, fields: withSolutions(fields, fields.solutions) }
  if (Object.hasOwn(edits, 'solution') || Object.hasOwn(edits, 'subSolution')) delete fields.solutions
  return { ...record, fields }
}

export const productValues = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : valueText(value).split(/[,，、]/)).map((s) => s.trim()).filter(Boolean)
export function flattenDicts(nodes: DictNode[]): DictNode[] {
  const found = new Map<number, DictNode>()
  const visit = (items: DictNode[]) => items.forEach((item) => { found.set(item.id, item); visit(item.children ?? []) })
  visit(nodes)
  return [...found.values()]
}
const dictTypes: Record<string, string> = { solution: 'solution', subSolution: 'sub_solution', purchasedProducts: 'product', industry: 'industry', subIndustry: 'sub_industry', track: 'track', securityDirection: 'security_direction' }
const parents: Record<string, string[]> = { subSolution: ['solution'], subIndustry: ['industry'] }
export function fieldContext(key: string, fields: Partial<ProjectInput>): Record<string, string> {
  return Object.fromEntries((parents[key] ?? []).map((field) => [field, valueText(fieldValue(fields, field))]))
}
export function optionsForField(key: string, fields: Partial<ProjectInput>, dictionaries: DictNode[], defs: CustomFieldDef[]): string[] | null {
  if (key === 'projectStatus') return [...PROJECT_STATUSES]
  if (key === 'purchasedProducts') return productDefinitions().map((p) => p.code)
  if (key.startsWith('custom.')) {
    const def = defs.find((d) => d.fieldKey === key.slice(7))
    return def?.fieldType === 'option' ? def.options : null
  }
  const type = dictTypes[key]
  if (!type) return null
  const all = flattenDicts(dictionaries)
  const items = all.filter((d) => d.type === type)
  // 后端在未配置子行业字典时允许自由文本；方案及产品仍强制父子关联。
  if (key === 'subIndustry' && !items.length) return null
  if (parents[key]) {
    const parentKey = parents[key].at(-1)!
    const parentCandidates = all.filter((d) => d.type === dictTypes[parentKey] && d.value.toLowerCase() === valueText(fieldValue(fields, parentKey)).toLowerCase())
    const parentOptions = parentKey === 'subSolution' ? optionsForField(parentKey, fields, dictionaries, defs) : null
    const ids = new Set(parentCandidates.filter((d) => !parentOptions || parentOptions.includes(d.value)).map((d) => d.id))
    // 产品的细分方案必须属于当前解决方案，同名细分方案也不能跨父级。
    if (key === 'purchasedProducts') {
      const solutionIds = new Set(all.filter((d) => d.type === 'solution' && d.value.toLowerCase() === valueText(fields.solution).toLowerCase()).map((d) => d.id))
      parentCandidates.forEach((d) => { if (!solutionIds.has(d.parentId!)) ids.delete(d.id) })
    }
    if (key === 'subIndustry' && !valueText(fields.industry)) return [...new Set(items.map((d) => d.value))]
    return [...new Set(items.filter((d) => ids.has(d.parentId!)).map((d) => d.value))]
  }
  return items.length ? [...new Set(items.map((d) => d.value))] : null
}

/** 演示预检与正式执行共用；接收合并后的项目，避免更新已有项目时误报缺失。 */
export function validateImportRecord(record: ImportRecordInput, dictionaries: DictNode[], defs: CustomFieldDef[], pending: ImportFieldDefinition[] = [], existing?: Project): ImportIssue[] {
  const fields = record.fields
  const issues: ImportIssue[] = []
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message })
  let selections: SolutionSelection[] = []
  try {
    selections = solutionSelections(fields)
    if (!Array.isArray(selections) || selections.some((s) => !s || typeof s.solution !== 'string' || !s.solution.trim() || !Array.isArray(s.subSolutions) || s.subSolutions.some((sub) => typeof sub !== 'string' || !sub.trim()))) throw new Error('方案集合必须包含解决方案和细分方案数组')
    const all = flattenDicts(dictionaries)
    for (const s of selections) {
      const parent = all.find((d) => d.type === 'solution' && d.value.toLowerCase() === s.solution.toLowerCase())
      if (dictionaries.length && !parent) add('solutions', 'option', `无效解决方案：${s.solution}`)
      if (s.subSolutions.some((v) => !all.some((d) => d.type === 'sub_solution' && d.parentId === parent?.id && d.value.toLowerCase() === v.toLowerCase()))) add('solutions', 'option', '细分方案与上级方案不匹配')
    }
  } catch (error) { add('solutions', 'format', (error as Error).message) }
  for (const key of ['customerName', 'projectName']) if (!valueText(fieldValue(fields, key))) add(key, 'required', `${fieldLabel(key, defs)}不能为空`)
  for (const key of ['externalId', 'customerName', 'projectName', 'solution', 'subSolution', 'industry', 'subIndustry', 'track', 'scenario', 'keyNeeds', 'keyRisks']) {
    const max = key === 'externalId' ? 128 : ['scenario', 'keyNeeds', 'keyRisks'].includes(key) ? 20000 : 255
    if (valueText(fieldValue(fields, key)).length > max) add(key, 'length', `${fieldLabel(key, defs)}超过允许长度 ${max}`)
  }
  for (const key of ['projectStatus', ...Object.keys(dictTypes)]) {
    const values = key === 'purchasedProducts' ? productValues(fields.purchasedProducts) : [valueText(fieldValue(fields, key))].filter(Boolean)
    const allowed = optionsForField(key, fields, dictionaries, defs)
    if (allowed && values.some((value) => !allowed.some((item) => key === 'projectStatus' ? item === value : item.toLowerCase() === value.toLowerCase()))) add(key, 'option', `请选择${fieldLabel(key, defs)}的标准选项${parents[key] ? '（需符合上级关联）' : ''}`)
  }
  if (productValues(fields.purchasedProducts).some((product) => !normalizeProductCode(product))) add('purchasedProducts', 'option', '请选择产品目录中的产品')
  for (const value of productValues(fields.purchasedProducts)) {
    const code = normalizeProductCode(value), product = productDefinitions().find((p) => p.code === code)
    if (product && !existing?.purchasedProducts.includes(product.code) && (!product.enabled || product.applicableTracks.length && !product.applicableTracks.includes(fields.track ?? ''))) add('purchasedProducts', 'option', `产品已停用或不适用当前赛道：${product.name}`)
  }
  if (fields.projectStatus === '中标') {
    if (!selections.length) add('solution', 'required', '中标时必须确认解决方案')
    if (!selections.some((s) => s.subSolutions.length)) add('subSolution', 'required', '中标时必须确认细分解决方案')
    if (!productValues(fields.purchasedProducts).length) add('purchasedProducts', 'required', '中标时至少选择一个已购产品')
  }
  const budgetError = validateSecurityBudget(fields.securityBudget)
  if (budgetError) add('securityBudget', 'format', budgetError)
  const allDefs = new Map(defs.map((def) => [def.fieldKey, def]))
  for (const p of pending) {
    if (!Object.hasOwn(fields.customFields ?? {}, p.fieldKey)) continue
    if (!p.label.trim() || p.label.trim().length > 255 || !/^[a-z][a-z0-9_]{0,63}$/.test(p.fieldKey)) add(`custom.${p.fieldKey}`, 'definition', '待新增字段名称或标识不合法')
    const existing = allDefs.get(p.fieldKey)
    if (existing && existing.fieldType !== p.fieldType) add(`custom.${p.fieldKey}`, 'definition', '字段已存在且类型不同，请重新选择目标字段')
    if (!existing) allDefs.set(p.fieldKey, { ...p, id: 0, required: false, options: [], sortOrder: 0 })
  }
  for (const key of Object.keys(fields.customFields ?? {})) if (!allDefs.has(key)) add(`custom.${key}`, 'definition', '自定义字段尚未定义')
  for (const def of allDefs.values()) {
    if (!appliesToTrack(def, fields.track)) continue
    const value = valueText(fields.customFields?.[def.fieldKey])
    const key = `custom.${def.fieldKey}`
    if (!value) { if (def.required) add(key, 'required', `${def.label}为必填项`); continue }
    if (def.fieldType === 'option' && !def.options.includes(value)) add(key, 'option', `请选择“${def.label}”的标准选项`)
    if (def.fieldType === 'number' && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))) add(key, 'format', `${def.label}必须是数字`)
    if (def.fieldType === 'date' && (normalizeDateValue(value) !== value)) add(key, 'format', `${def.label}必须是有效日期 YYYY-MM-DD`)
  }
  record.revenues.forEach((cell, index) => {
    if (!isValidMonth(cell.month) || validateSecurityBudget(cell.amount)) add(`revenues.${index}`, 'format', '收入月份或金额不合法')
  })
  record.progress.forEach((entry, index) => {
    if (normalizeDateValue(entry.logDate) !== entry.logDate || !entry.content.trim() || entry.content.length > 10000) add(`progress.${index}`, 'format', '进展日期或内容不合法')
  })
  return issues
}

export function mergeImportFields(incoming: Partial<ProjectInput>, existing?: Partial<ProjectInput>): Partial<ProjectInput> {
  const customFields = { ...existing?.customFields }
  for (const [key, value] of Object.entries(incoming.customFields ?? {})) {
    if (value == null || valueText(value) === '') delete customFields[key]
    else customFields[key] = value
  }
  const merged = { ...existing, ...incoming, customFields }
  if (!Object.hasOwn(incoming, 'solutions') && (Object.hasOwn(incoming, 'solution') || Object.hasOwn(incoming, 'subSolution'))) delete merged.solutions
  if (Array.isArray(merged.solutions)) Object.assign(merged, withSolutions(merged, normalizeSolutions(merged.solutions)))
  return { ...merged, projectStatus: merged.projectStatus || '机会点识别' }
}

export function mappingRule(field: string, from: string, to: string, when: Record<string, string>): ValueRule {
  return { type: 'exact', source: '', matchField: field, when, mapping: { [from]: { [field]: to } } }
}
