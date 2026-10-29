import { PROJECT_FIELD_LABELS, REQUIRED_PROJECT_FIELDS, appliesToTrack } from '@/lib/fields'
import type { CustomFieldDef, Project, ProjectInput } from '@/types'
import { normalizeSolutions, solutionSelections, withSolutions } from '@/lib/solutions'
import { parseFixedTarget, PROJECT_LEVELS } from '@/lib/followUp'

// ============================================================
// 项目表单/编辑的纯函数工具：列表行内编辑、新建 Dialog、详情概览共用
// ============================================================

export function emptyProjectInput(): ProjectInput {
  return {
    externalId: null,
    fixedTarget: false, projectLevel: '',
    hcsOpportunityId: '', responsibleIds: [],
    customerName: '',
    projectName: '',
    projectStatus: '机会点识别',
    securityBudget: null,
    solution: '',
    subSolution: '',
    solutions: [],
    purchasedProducts: [],
    track: '',
    securityDirection: '',
    industry: '',
    subIndustry: '',
    scenario: '',
    keyNeeds: '',
    keyRisks: '',
    customFields: {},
    nextActionDate: null, nextActionNote: '',
  }
}

/** 从列表/详情的 Project 提取可提交的 ProjectInput */
export function projectToInput(p: Project): ProjectInput {
  return {
    externalId: p.externalId,
    fixedTarget: p.fixedTarget ?? false, projectLevel: p.projectLevel ?? '',
    hcsOpportunityId: p.hcsOpportunityId ?? '', responsibleIds: [...(p.responsibleIds ?? [])],
    customerName: p.customerName,
    projectName: p.projectName,
    projectStatus: p.projectStatus ?? '机会点识别',
    securityBudget: p.securityBudget ?? null,
    solution: p.solution ?? '',
    subSolution: p.subSolution ?? '',
    solutions: solutionSelections(p).map((s) => ({ ...s, subSolutions: [...s.subSolutions] })),
    purchasedProducts: [...(p.purchasedProducts ?? [])],
    track: p.track ?? '',
    securityDirection: p.securityDirection ?? '',
    industry: p.industry ?? '',
    subIndustry: p.subIndustry ?? '',
    scenario: p.scenario ?? '',
    keyNeeds: p.keyNeeds ?? '',
    keyRisks: p.keyRisks ?? '',
    customFields: { ...(p.customFields ?? {}) },
    nextActionDate: p.nextActionDate ?? null, nextActionNote: p.nextActionNote ?? '',
  }
}

/** 必填校验，返回错误文案；null 表示通过 */
export function validateProjectInput(input: ProjectInput, customDefs: CustomFieldDef[]): string | null {
  if (input.fixedTarget != null && typeof input.fixedTarget !== 'boolean') return '是否固定靶须选择是或否'
  if (input.projectLevel && !PROJECT_LEVELS.includes(input.projectLevel)) return '项目级别只能为无风险、低风险、高风险'
  for (const key of REQUIRED_PROJECT_FIELDS) {
    if (!String(input[key] ?? '').trim()) return `请填写${PROJECT_FIELD_LABELS[key] ?? key}`
  }
  const budgetError = validateSecurityBudget(input.securityBudget)
  if (budgetError) return budgetError
  const selections = solutionSelections(input)
  if (selections.some((s) => !s.solution.trim())) return '请选择或移除空的解决方案'
  if (input.projectStatus === '中标') {
    if (!selections.length) return '中标时请选择解决方案'
    if (!selections.some((s) => s.subSolutions.length)) return '中标时请选择细分解决方案'
    if (input.purchasedProducts.length === 0) return '中标时至少选择一个已购产品'
  }
  for (const def of customDefs) {
    if (!appliesToTrack(def, input.track)) continue
    if (!def.required) continue
    const v = input.customFields?.[def.fieldKey]
    if (v == null || String(v).trim() === '') return `请填写${def.label}`
  }
  return null
}

/** 提交前规整：externalId 空串转 null；自定义 number 字段空串转 null、否则转数值 */
export function normalizeForSubmit(input: ProjectInput, customDefs: CustomFieldDef[]): ProjectInput {
  const customFields: Record<string, unknown> = { ...(input.customFields ?? {}) }
  for (const def of customDefs) {
    if (!appliesToTrack(def, input.track)) continue
    const raw = customFields[def.fieldKey]
    if (raw == null) continue
    if (def.fieldType === 'number') {
      const s = String(raw).trim()
      customFields[def.fieldKey] = s === '' ? null : Number(s)
    }
  }
  return {
    ...withSolutions(input, normalizeSolutions(solutionSelections(input))),
    nextActionDate: input.nextActionDate || null,
    externalId: input.externalId?.trim() ? input.externalId.trim() : null,
    securityBudget: input.securityBudget == null || String(input.securityBudget).trim() === ''
      ? null
      : Number(input.securityBudget),
    customFields,
  }
}

/** 客户安全预算：选填、非负、最多 16 位整数和 2 位小数。 */
export function validateSecurityBudget(value: unknown): string | null {
  if (value == null || String(value).trim() === '') return null
  const text = String(value).trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return '客户安全预算必须是非负数字，最多保留两位小数'
  const [integer] = text.split('.')
  if (integer.replace(/^0+/, '').length > 16) return '客户安全预算超出允许范围'
  return null
}

/** 把一次单元格编辑合并进 ProjectInput；行业变更时联动清空子行业 */
export function applyFieldEdit(input: ProjectInput, key: string, value: string): ProjectInput {
  if (key === 'fixedTarget') return { ...input, fixedTarget: parseFixedTarget(value) ?? input.fixedTarget ?? false }
  if (key.startsWith('custom.')) {
    return { ...input, customFields: { ...input.customFields, [key.slice(7)]: value } }
  }
  if (key === 'industry') {
    return { ...input, industry: value, subIndustry: '' }
  }
  if (key === 'solution') {
    return withSolutions(input, value ? [{ solution: value, subSolutions: [] }] : [])
  }
  if (key === 'subSolution') {
    return withSolutions(input, input.solution ? [{ solution: input.solution, subSolutions: value ? [value] : [] }] : [])
  }
  if (key === 'purchasedProducts') {
    return { ...input, purchasedProducts: value.split(/[、,，]/).map((v) => v.trim()).filter(Boolean) }
  }
  return { ...input, [key]: value }
}

/** 修改日志的字段名翻译：基础字段查表 / custom.xxx / revenue:YYYY-MM */
export function changeLogFieldLabel(field: string, customDefs: CustomFieldDef[]): string {
  if (field === 'projectIdentity') return '项目匹配标识'
  if (field === 'responsibles' || field === 'responsibleIds') return '责任人'
  if (field.startsWith('progress.')) return '进展修正'
  if (field.startsWith('custom.')) {
    const k = field.slice(7)
    return customDefs.find((d) => d.fieldKey === k)?.label ?? field
  }
  if (field.startsWith('revenue:')) return `收入(${field.slice(8)})`
  return PROJECT_FIELD_LABELS[field] ?? field
}

/** 修改日志来源翻译 */
export function changeLogSourceLabel(source: string): string {
  if (source === 'manual') return '手工'
  if (source === 'import') return '导入'
  if (source === 'hcs') return 'HCS'
  return source
}
