import { PROJECT_STATUSES, type CustomFieldDef, type DictNode, type Project } from '@/types'
import { businessDate } from './actions'

export interface FollowUpRule { value: string; days: number }
export interface FollowUpField { key: string; label: string; type: 'text' | 'option'; options: { value: string; label: string }[]; applicableTracks: string[] }
export interface FollowUpPolicy {
  /** Retained for old API clients and stored browser rules. */
  fixedTargetDays: number; normalDays: number
  fieldKey?: string; defaultDays?: number; rules?: FollowUpRule[]; fieldLabel?: string; applicableTracks?: string[]
}
export const DEFAULT_FOLLOW_UP_POLICY: FollowUpPolicy = { fixedTargetDays: 7, normalDays: 14 }
export const PROJECT_LEVELS = ['无风险', '低风险', '高风险'] as const

export function normalizeFollowUpPolicy(policy: FollowUpPolicy) {
  if (!policy.fieldKey) return { ...policy, fieldKey: 'fixedTarget', fieldLabel: '是否固定靶', defaultDays: policy.normalDays, rules: [{ value: 'true', days: policy.fixedTargetDays }, { value: 'false', days: policy.normalDays }], applicableTracks: [] as string[] }
  if (typeof policy.defaultDays !== 'number' || !Array.isArray(policy.rules)) throw new Error('跟进关联规则不完整，请重新配置')
  return { ...policy, fieldKey: policy.fieldKey, defaultDays: policy.defaultDays!, rules: policy.rules, applicableTracks: policy.applicableTracks ?? [] }
}
export function followUpFields(defs: CustomFieldDef[], dictionaries: DictNode[]): FollowUpField[] {
  const all: DictNode[] = [], visit = (nodes: DictNode[]) => nodes.forEach((node) => { all.push(node); visit(node.children ?? []) }); visit(dictionaries)
  const options = (values: string[]) => [...new Set(values)].map((value) => ({ value, label: value }))
  return [
    { key: 'fixedTarget', label: '是否固定靶', type: 'option', options: [{ value: 'true', label: '是' }, { value: 'false', label: '否' }], applicableTracks: [] },
    { key: 'projectLevel', label: '项目级别', type: 'option', options: options([...PROJECT_LEVELS]), applicableTracks: [] },
    { key: 'projectStatus', label: '本地售前状态', type: 'option', options: options([...PROJECT_STATUSES]), applicableTracks: [] },
    { key: 'track', label: '赛道', type: 'option', options: options(['HCS', '公有云']), applicableTracks: [] },
    ...[['industry', '行业', 'industry'], ['subIndustry', '子行业', 'sub_industry'], ['securityDirection', '安全方向', 'security_direction']].map(([key, label, type]) => ({ key, label, type: 'option' as const, options: options(all.filter((d) => d.type === type).map((d) => d.value)), applicableTracks: [] })),
    { key: 'hcsStatus', label: 'HCS状态', type: 'text', options: [], applicableTracks: [] },
    ...defs.filter((def) => ['text', 'option'].includes(def.fieldType)).map((def) => ({ key: `custom.${def.fieldKey}`, label: `${def.label}（自定义）`, type: def.fieldType as 'text' | 'option', options: options(def.options), applicableTracks: def.applicableTracks ?? [] })),
  ]
}
export function validateFollowUpPolicy(input: FollowUpPolicy, fields: FollowUpField[]): string | null {
  const policy = normalizeFollowUpPolicy(input), field = fields.find((f) => f.key === policy.fieldKey)
  if (!field) return '关联字段不存在或类型不受支持'
  if (policy.rules.length > 100 || ![policy.defaultDays, ...policy.rules.map((r) => r.days)].every((n) => Number.isInteger(n) && n >= 1 && n <= 3650)) return '周期必须为 1—3650 天的整数，最多100条规则'
  const seen = new Set<string>()
  for (const rule of policy.rules) {
    const value = rule.value.trim().toLowerCase()
    if (!value || rule.value.trim().length > 255 || seen.has(value)) return '规则值不能为空或重复，且最多255字符'
    if (field.type === 'option' && !field.options.some((o) => o.value.toLowerCase() === value)) return `规则值不在关联字段的选项中：${rule.value}`
    seen.add(value)
  }
  return null
}

export function parseFixedTarget(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  const text = String(value ?? '').trim().toLowerCase()
  if (['是', 'true', '1', 'yes', 'y'].includes(text)) return true
  if (['', '否', 'false', '0', 'no', 'n'].includes(text)) return false
  return null
}
function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / 86400000 : NaN
}
function shanghaiDate(value?: string | null) {
  if (!value) return ''
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) { const date=new Date(value); return Number.isFinite(date.getTime()) ? businessDate(date) : '' }
  return value.slice(0, 10) // Backend LocalDateTime values already use Asia/Shanghai.
}
export function formatFollowUpTime(value?: string | null) {
  if (!value) return '无业务修改记录'
  if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) return value.replace('T', ' ').slice(0, 19)
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date) : '跟进时间待核对'
}
export function followUpReminder(project: Pick<Project, 'fixedTarget' | 'lastFollowUpAt' | 'createdAt' | 'projectStatus' | 'deleted'> & Partial<Project>, input: FollowUpPolicy, today = businessDate()) {
  const policy = normalizeFollowUpPolicy(input)
  const monitored = !project.deleted && project.projectStatus !== '中标'
  const custom = policy.fieldKey.startsWith('custom.')
  const applicable = !custom || !policy.applicableTracks.length || policy.applicableTracks.includes(project.track ?? '')
  const raw = policy.fieldKey === 'fixedTarget' ? String(project.fixedTarget === true) : custom ? project.customFields?.[policy.fieldKey.slice(7)] : (project as Record<string, unknown>)[policy.fieldKey]
  const value = applicable && typeof raw === 'string' ? raw.trim() : ''
  const rule = policy.rules.find((r) => r.value.toLowerCase() === value.toLowerCase())
  const interval = rule?.days ?? policy.defaultDays
  const fieldLabel = policy.fieldLabel ?? policy.fieldKey
  const matchLabel = policy.fieldKey === 'fixedTarget' ? value === 'true' ? '是' : '否' : !applicable ? '不适用当前赛道' : value || '未填写'
  const baseDate = shanghaiDate(project.lastFollowUpAt || project.createdAt), base = dayNumber(baseDate), current = dayNumber(today)
  const valid = Number.isFinite(base) && Number.isFinite(current)
  const days = valid ? Math.max(0, current - base) : null
  const dueDate = valid ? new Date((base + interval) * 86400000).toISOString().slice(0, 10) : null
  const due = monitored && valid && current >= base + interval
  const overdueDays = due ? current - base - interval : 0
  const label = !monitored ? project.deleted ? '回收站不提醒' : '中标不提醒' : !valid ? '跟进时间待核对' : due ? overdueDays ? `逾期 ${overdueDays} 天需跟进` : '今天需跟进' : `距下次跟进 ${base + interval - current} 天`
  return { monitored, interval, days, dueDate, due, overdueDays, label, fieldLabel, matchLabel, matched: !!rule, tone: due ? overdueDays ? 'border-red-400 bg-red-50 text-red-700' : 'border-orange-300 bg-orange-100 text-orange-900' : 'border-transparent text-muted-foreground' }
}
