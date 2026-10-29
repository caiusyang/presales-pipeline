import type { Project } from '@/types'
import { businessDate } from './actions'

export interface FollowUpPolicy { fixedTargetDays: number; normalDays: number }
export const DEFAULT_FOLLOW_UP_POLICY: FollowUpPolicy = { fixedTargetDays: 7, normalDays: 14 }
export const PROJECT_LEVELS = ['无风险', '低风险', '高风险'] as const

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
export function followUpReminder(project: Pick<Project, 'fixedTarget' | 'lastFollowUpAt' | 'createdAt' | 'projectStatus' | 'deleted'>, policy: FollowUpPolicy, today = businessDate()) {
  const monitored = !project.deleted && project.projectStatus !== '中标'
  const interval = project.fixedTarget === true ? policy.fixedTargetDays : policy.normalDays
  const baseDate = shanghaiDate(project.lastFollowUpAt || project.createdAt), base = dayNumber(baseDate), current = dayNumber(today)
  const valid = Number.isFinite(base) && Number.isFinite(current)
  const days = valid ? Math.max(0, current - base) : null
  const dueDate = valid ? new Date((base + interval) * 86400000).toISOString().slice(0, 10) : null
  const due = monitored && valid && current >= base + interval
  const overdueDays = due ? current - base - interval : 0
  const label = !monitored ? project.deleted ? '回收站不提醒' : '中标不提醒' : !valid ? '跟进时间待核对' : due ? overdueDays ? `逾期 ${overdueDays} 天需跟进` : '今天需跟进' : `距下次跟进 ${base + interval - current} 天`
  return { monitored, interval, days, dueDate, due, overdueDays, label, tone: due ? overdueDays ? 'border-red-400 bg-red-50 text-red-700' : 'border-orange-300 bg-orange-100 text-orange-900' : 'border-transparent text-muted-foreground' }
}
