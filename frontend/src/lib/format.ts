import dayjs from 'dayjs'

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

/** 从进展单元格文本拆出多条进展：按换行拆行，支持 `日期：内容` / `日期:内容` 等写法，无日期归入 fallbackDate */
export function parseProgressText(
  text: string,
  fallbackDate: string,
): { logDate: string; content: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2})日?\s*[:：]?\s*(.*)$/)
      if (m) {
        const norm = m[1]
          .replace(/[年/.]/g, '-')
          .replace(/月/g, '-')
          .replace(/日/g, '')
          .split('-')
          .map((seg, i) => (i === 0 ? seg : seg.padStart(2, '0')))
          .join('-')
        return { logDate: DATE_RE.test(norm) ? norm : fallbackDate, content: m[2] || line }
      }
      return { logDate: fallbackDate, content: line }
    })
}
