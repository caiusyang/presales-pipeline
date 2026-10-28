import dayjs from 'dayjs'
import { parseProgressCell } from './progressDate'

/** 金额展示：万元，空值显示 - */
export function fmtAmount(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '-'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** 生成最近 n 个月（含当月）的 YYYY-MM 列表，升序 */
export function recentMonths(n = 12, end?: string): string[] {
  const endD = end ? dayjs(end + '-01') : dayjs()
  const list: string[] = []
  for (let i = n - 1; i >= 0; i--) list.push(endD.subtract(i, 'month').format('YYYY-MM'))
  return list
}

/** 某自然年的 12 个月 YYYY-MM 列表 */
export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidMonth(s: string): boolean {
  return MONTH_RE.test(s)
}

/** 严格解析；旧签名传日期时仅取年份，不再回退到当天。错误需由调用方展示。 */
export function parseProgressText(
  text: string,
  defaultYear: number | string,
): { logDate: string; content: string }[] {
  return parseProgressCell(text, typeof defaultYear === 'number' ? defaultYear : Number(defaultYear.slice(0, 4))).entries
}
