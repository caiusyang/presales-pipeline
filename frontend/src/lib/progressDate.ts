export interface ParsedProgress { logDate: string; content: string }
export interface ProgressDateIssue { line: number; text: string; message: string }

export function strictDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
}

/** A date starts a record. Other lines belong to the current record; never infer today's date. */
export function parseProgressCell(text: string, defaultYear?: number): { entries: ParsedProgress[]; issues: ProgressDateIssue[] } {
  const entries: ParsedProgress[] = [], issues: ProgressDateIssue[] = []
  let current: ParsedProgress | null = null
  for (const [index, raw] of text.split(/\r\n|\n|\r/).entries()) {
    const line = raw.trim()
    if (!line) { if (current) current.content += '\n'; continue }
    const full = line.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?=$|\s|[:：、,，])\s*[:：、,，]?\s*(.*)$/)
    const short = full ? null : line.match(/^(\d{1,2})(?:月|\/|\.|-)(\d{1,2})日?(?=$|\s|[:：、,，])\s*[:：、,，]?\s*(.*)$/)
    if (full || short) {
      const year = full ? Number(full[1]) : defaultYear
      const date = year == null ? null : strictDate(year, Number(full ? full[2] : short![1]), Number(full ? full[3] : short![2]))
      const content = full ? full[4] : short![3]
      if (!date || !content) {
        issues.push({ line: index + 1, text: line, message: year == null ? '缺少年份，请选择默认年份' : !date ? '日期不存在或年份不合法' : '进展内容不能为空' })
        current = null
      } else { current = { logDate: date, content }; entries.push(current) }
    } else if (/^(?:\d{4}\D|\d{1,2}[月/.-]\d)/.test(line)) {
      issues.push({ line: index + 1, text: line, message: '行首日期格式无法识别，请使用 YYYY-MM-DD：内容' }); current = null
    } else if (current) current.content += '\n' + raw.trimEnd()
    else issues.push({ line: index + 1, text: line, message: '首段或错误日期后的内容没有有效日期，请补全日期' })
  }
  for (const entry of entries) entry.content = entry.content.trim()
  return { entries, issues }
}
