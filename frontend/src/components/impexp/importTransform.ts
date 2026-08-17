import type { MonthStr, ProjectInput, ValueRule } from '@/types'
import type { ImportRecordInput } from '@/api/types'
import { PROJECT_FIELD_LABELS, REQUIRED_PROJECT_FIELDS } from '@/lib/fields'
import { isValidMonth, parseProgressText } from '@/lib/format'

// ============================================================
// 导入组装纯函数：columnMap 抽取 → valueRules（split → exact → default）
// → progressText 拆多条 → revenue:YYYY-MM 收入 → 必填校验
// ============================================================

/** columnMap 目标前缀：某月收入列，值为 `revenue:YYYY-MM` */
export const REVENUE_PREFIX = 'revenue:'
/** columnMap 目标前缀：自定义字段，值为 `custom.{fieldKey}` */
export const CUSTOM_PREFIX = 'custom.'
/** columnMap 目标：进展多行文本列 */
export const PROGRESS_TARGET = 'progressText'
/** 列映射 UI 中「按月收入列（指定月份）」的内部哨兵值（非契约，仅存于界面状态） */
export const REVENUE_SENTINEL = '__revenue__'

// ---------- 列映射界面状态 ----------

/** 每个 Excel 列的映射选择状态；target='' 表示忽略 */
export interface ColumnTarget {
  target: string
  /** target 为 REVENUE_SENTINEL 时填写的月份 YYYY-MM */
  month: string
}

/** 求某列的有效 columnMap 值；收入月份非法或未选择时返回 null */
export function effectiveTarget(t: ColumnTarget): string | null {
  if (!t.target) return null
  if (t.target === REVENUE_SENTINEL) {
    return isValidMonth(t.month) ? `${REVENUE_PREFIX}${t.month}` : null
  }
  return t.target
}

/** 由界面选择状态组装契约 columnMap（Excel 列名 → 目标 key） */
export function buildColumnMap(headers: string[], targets: ColumnTarget[]): Record<string, string> {
  const map: Record<string, string> = {}
  headers.forEach((h, i) => {
    const t = targets[i]
    const eff = t ? effectiveTarget(t) : null
    if (eff) map[h] = eff
  })
  return map
}

/** 载入已存方案：columnMap → 界面选择状态（按列名对齐，未命中列忽略） */
export function targetsFromColumnMap(headers: string[], columnMap: Record<string, string>): ColumnTarget[] {
  return headers.map((h) => {
    const v = columnMap[h]
    if (!v) return { target: '', month: '' }
    if (v.startsWith(REVENUE_PREFIX)) {
      return { target: REVENUE_SENTINEL, month: v.slice(REVENUE_PREFIX.length) }
    }
    return { target: v, month: '' }
  })
}

// ---------- 值映射规则编辑态 ----------
// ValueRule 是紧凑契约结构，不便于直接双向编辑（尤其 exact 的空行），
// 界面使用 RuleDraft 编辑态，保存/组装时互相转换。

export interface ExactDraftRow {
  /** 源值 */
  src: string
  /** 目标字段 key */
  field: string
  /** 目标值 */
  value: string
}

export type RuleDraft =
  | { kind: 'exact'; source: string; rows: ExactDraftRow[] }
  | { kind: 'split'; source: string; delimiter: string; targetsText: string }
  | { kind: 'default'; field: string; value: string }

/** 编辑态 → 契约 ValueRule[]（丢弃不完整的行） */
export function draftsToRules(drafts: RuleDraft[]): ValueRule[] {
  const rules: ValueRule[] = []
  for (const d of drafts) {
    if (d.kind === 'exact') {
      const mapping: Record<string, Record<string, string>> = {}
      for (const r of d.rows) {
        const src = r.src.trim()
        if (!src || !r.field) continue
        mapping[src] ??= {}
        mapping[src][r.field] = r.value
      }
      rules.push({ type: 'exact', source: d.source, mapping })
    } else if (d.kind === 'split') {
      const targets = d.targetsText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
      rules.push({ type: 'split', source: d.source, delimiter: d.delimiter || '-', targets })
    } else {
      rules.push({ type: 'default', field: d.field, value: d.value })
    }
  }
  return rules
}

/** 契约 ValueRule[] → 编辑态（载入方案时用） */
export function rulesToDrafts(rules: ValueRule[]): RuleDraft[] {
  return rules.map((r): RuleDraft => {
    if (r.type === 'exact') {
      const rows: ExactDraftRow[] = []
      for (const [src, m] of Object.entries(r.mapping)) {
        for (const [field, value] of Object.entries(m)) rows.push({ src, field, value })
      }
      return { kind: 'exact', source: r.source, rows }
    }
    if (r.type === 'split') {
      return { kind: 'split', source: r.source, delimiter: r.delimiter, targetsText: r.targets.join(',') }
    }
    return { kind: 'default', field: r.field, value: r.value }
  })
}

// ---------- 组装 ----------

export interface TransformProblem {
  /** Excel 行号（表头占第 1 行，数据自第 2 行起） */
  excelRow: number
  message: string
}

export interface TransformOutput {
  records: ImportRecordInput[]
  problems: TransformProblem[]
}

export interface TransformParams {
  headers: string[]
  /** 数据行（不含表头），单元格已统一为 string */
  rows: string[][]
  columnMap: Record<string, string>
  valueRules: ValueRule[]
  /** 进展无日期时的兜底日期（今天，YYYY-MM-DD） */
  today: string
}

export function buildImportRecords({ headers, rows, columnMap, valueRules, today }: TransformParams): TransformOutput {
  // 列名 → 列下标（重名取第一个）
  const colIndex = new Map<string, number>()
  headers.forEach((h, i) => {
    if (!colIndex.has(h)) colIndex.set(h, i)
  })

  const mappedCols: { idx: number; target: string }[] = []
  for (const [colName, target] of Object.entries(columnMap)) {
    const idx = colIndex.get(colName)
    if (idx != null && target) mappedCols.push({ idx, target })
  }

  const problems: TransformProblem[] = []
  const records: ImportRecordInput[] = []

  rows.forEach((row, r) => {
    const excelRow = r + 2 // 表头第 1 行
    const fields: Record<string, unknown> = { customFields: {} }
    const customFields = fields.customFields as Record<string, unknown>
    const revenues: { month: MonthStr; amount: number }[] = []
    const progress: { logDate: string; content: string }[] = []

    /** 写字段（custom. 入 customFields）；overwrite=false 时仅填空值（default 规则语义） */
    const setField = (key: string, value: string, overwrite: boolean) => {
      if (!overwrite) {
        const cur = key.startsWith(CUSTOM_PREFIX) ? customFields[key.slice(CUSTOM_PREFIX.length)] : fields[key]
        if (cur != null && String(cur).trim() !== '') return
      }
      if (key.startsWith(CUSTOM_PREFIX)) customFields[key.slice(CUSTOM_PREFIX.length)] = value
      else fields[key] = value
    }

    // 1) 按 columnMap 抽取
    for (const { idx, target } of mappedCols) {
      const raw = (row[idx] ?? '').trim()
      if (target === PROGRESS_TARGET) {
        if (raw) progress.push(...parseProgressText(raw, today))
        continue
      }
      if (target.startsWith(REVENUE_PREFIX)) {
        if (!raw) continue // 空跳过
        const month = target.slice(REVENUE_PREFIX.length)
        const num = Number(raw.replace(/[,，\s¥￥]/g, ''))
        if (!Number.isFinite(num)) {
          problems.push({ excelRow, message: `收入列「${headers[idx]}」数值非法：「${raw}」，该月收入已忽略` })
          continue
        }
        revenues.push({ month, amount: num })
        continue
      }
      if (!raw) continue
      setField(target, raw, true)
    }

    // 2) valueRules：split → exact → default
    const cellOf = (colName: string): string => {
      const idx = colIndex.get(colName)
      return idx == null ? '' : (row[idx] ?? '').trim()
    }
    for (const rule of valueRules) {
      if (rule.type !== 'split') continue
      const raw = cellOf(rule.source)
      if (!raw) continue
      const parts = raw.split(rule.delimiter)
      rule.targets.forEach((t, i) => {
        const v = (parts[i] ?? '').trim()
        if (v) setField(t, v, true)
      })
    }
    for (const rule of valueRules) {
      if (rule.type !== 'exact') continue
      const raw = cellOf(rule.source)
      if (!raw) continue
      const hit = rule.mapping[raw]
      if (!hit) continue
      for (const [field, value] of Object.entries(hit)) {
        if (value.trim()) setField(field, value.trim(), true)
      }
    }
    for (const rule of valueRules) {
      if (rule.type !== 'default') continue
      if (rule.field && rule.value.trim()) setField(rule.field, rule.value.trim(), false)
    }

    // 3) 必填校验（缺失仅标记问题；该行仍提交，由后端判 skipped 并给出原因）
    for (const f of REQUIRED_PROJECT_FIELDS) {
      const v = fields[f]
      if (v == null || String(v).trim() === '') {
        problems.push({ excelRow, message: `必填字段缺失：${PROJECT_FIELD_LABELS[f] ?? f}` })
      }
    }

    records.push({ fields: fields as unknown as Partial<ProjectInput>, revenues, progress })
  })

  return { records, problems }
}

/** 提取某列的唯一值（供 exact 规则对照参考），最多 limit 个 */
export function columnUniqueValues(rows: string[][], colIdx: number, limit = 50): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    const v = (row[colIdx] ?? '').trim()
    if (v) seen.add(v)
    if (seen.size >= limit) break
  }
  return [...seen]
}
