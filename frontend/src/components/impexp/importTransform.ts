import type { CustomFieldType, MonthStr, ProjectInput, ValueRule } from '@/types'
import type { ImportRecordInput } from '@/api/types'
import { PROJECT_FIELD_LABELS, REQUIRED_PROJECT_FIELDS } from '@/lib/fields'
import { validateSecurityBudget } from '@/components/project/project-utils'
import { isValidMonth } from '@/lib/format'
import { parseProgressCell } from '@/lib/progressDate'
import { normalizeProductCode, PRODUCT_CATALOG, type ProductCode } from '@/lib/products'

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
/** columnMap 目标前缀：独立产品拥有列，值为 `product:<产品编码>`。 */
export const PRODUCT_PREFIX = 'product:'
/** 列映射 UI 中「已购产品（指定产品）」的内部哨兵值。 */
export const PRODUCT_SENTINEL = '__product__'
/** 待新增字段目标；保存时可附加 `:<URI 编码的名称>`，兼容未附名称的已有方案。 */
export const NEW_FIELD_PREFIX = '__new_custom__:'

export function normalizeDateValue(value: string): string | null {
  const text = value.trim()
  let match = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/)
  if (!match) {
    const us = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
    if (us) match = [us[0], us[3], us[1], us[2]]
  }
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function normalizeNumberValue(value: string): string | null {
  const text = value.trim()
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(text)) return null
  return text.replaceAll(',', '')
}

export interface PendingCustomField {
  fieldKey: string
  label: string
  fieldType: Extract<CustomFieldType, 'text' | 'number' | 'date'>
}

export function parsePendingField(target: string, fallbackLabel = ''): PendingCustomField | null {
  const match = target.match(/^__new_custom__:(text|number|date):([a-z][a-z0-9_]*)(?::(.*))?$/)
  if (!match) return null
  const [, fieldType, fieldKey, encodedLabel] = match
  let label = fallbackLabel.slice(0, 255)
  if (encodedLabel !== undefined) {
    try {
      label = decodeURIComponent(encodedLabel)
    } catch {
      // 损坏的名称编码使用原列名，保持旧方案可编辑。
    }
  }
  return { fieldKey, label, fieldType: fieldType as PendingCustomField['fieldType'] }
}

// ---------- 列映射界面状态 ----------

/** 每个 Excel 列的映射选择状态；target='' 表示忽略 */
export interface ColumnTarget {
  target: string
  /** target 为 REVENUE_SENTINEL 时填写的月份 YYYY-MM */
  month: string
  /** target 为 PRODUCT_SENTINEL 时选择的固定产品编码。 */
  product?: ProductCode | ''
  pendingField?: PendingCustomField
}

/** 求某列的有效 columnMap 值；收入月份非法或未选择时返回 null */
export function effectiveTarget(t: ColumnTarget): string | null {
  if (!t.target) return null
  if (t.target === REVENUE_SENTINEL) {
    return isValidMonth(t.month) ? `${REVENUE_PREFIX}${t.month}` : null
  }
  if (t.target === PRODUCT_SENTINEL) {
    return t.product && normalizeProductCode(t.product) ? `${PRODUCT_PREFIX}${t.product}` : null
  }
  return t.target
}

/** 由界面选择状态组装契约 columnMap（Excel 列名 → 目标 key） */
export function buildColumnMap(headers: string[], targets: ColumnTarget[]): Record<string, string> {
  const map: Record<string, string> = {}
  headers.forEach((h, i) => {
    const t = targets[i]
    const eff = t ? effectiveTarget(t) : null
    if (eff) {
      map[h] = eff.startsWith(NEW_FIELD_PREFIX) && t.pendingField
        ? `${NEW_FIELD_PREFIX}${t.pendingField.fieldType}:${t.pendingField.fieldKey}:${encodeURIComponent(t.pendingField.label.trim())}`
        : eff
    }
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
    if (v.startsWith(PRODUCT_PREFIX)) {
      const product = normalizeProductCode(v.slice(PRODUCT_PREFIX.length))
      if (product) return { target: PRODUCT_SENTINEL, month: '', product }
    }
    if (v.startsWith(NEW_FIELD_PREFIX)) {
      const field = parsePendingField(v, h)
      if (field) {
        return {
          target: `${NEW_FIELD_PREFIX}${field.fieldType}:${field.fieldKey}`,
          month: '',
          pendingField: field,
        }
      }
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
  | { kind: 'exact'; source: string; rows: ExactDraftRow[]; matchField?: string; when?: Record<string, string> }
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
      rules.push({ type: 'exact', source: d.source, mapping, ...(d.matchField ? { matchField: d.matchField, when: d.when } : {}) })
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
      return { kind: 'exact', source: r.source, rows, matchField: r.matchField, when: r.when }
    }
    if (r.type === 'split') {
      return { kind: 'split', source: r.source, delimiter: r.delimiter, targetsText: r.targets.join(',') }
    }
    return { kind: 'default', field: r.field, value: r.value }
  })
}

// ---------- 组装 ----------

export interface TransformProblem {
  field?: string
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
  /** 本次业务日期，仅保留给旧调用方；不作为进展兜底日期 */
  today: string
  defaultYear?: number
  /** 第一条数据在原 Excel 中的 1-based 行号 */
  dataStartRow?: number
}

export function buildImportRecords({ headers, rows, columnMap, valueRules, defaultYear, dataStartRow = 2 }: TransformParams): TransformOutput {
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
    const excelRow = r + dataStartRow
    const fields: Record<string, unknown> = { customFields: {} }
    const customFields = fields.customFields as Record<string, unknown>
    const revenues: { month: MonthStr; amount: number }[] = []
    const progress: { logDate: string; content: string }[] = []
    const purchasedProducts = new Set<ProductCode>()
    let hasProductColumn = false
    const sourceValues = new Map<string, { value: string; idx: number }>()

    /** 写字段（custom. 入 customFields）；overwrite=false 时仅填空值（default 规则语义） */
    const setField = (key: string, value: string, overwrite: boolean) => {
      if (key.startsWith(NEW_FIELD_PREFIX)) {
        const field = parsePendingField(key)
        if (!field) return
        const { fieldType, fieldKey } = field
        let normalized = value
        if (fieldType === 'number') normalized = normalizeNumberValue(value) ?? value
        if (fieldType === 'date') normalized = normalizeDateValue(value) ?? value
        if (!overwrite && customFields[fieldKey] != null && String(customFields[fieldKey]).trim() !== '') return
        customFields[fieldKey] = normalized
        return
      }
      if (!overwrite) {
        const cur = key.startsWith(CUSTOM_PREFIX) ? customFields[key.slice(CUSTOM_PREFIX.length)] : fields[key]
        if (cur != null && String(cur).trim() !== '') return
      }
      if (key.startsWith(CUSTOM_PREFIX)) customFields[key.slice(CUSTOM_PREFIX.length)] = value
      else if (key === 'solutions') {
        try { fields[key] = JSON.parse(value) } catch { fields[key] = value; problems.push({ excelRow, field: 'solutions', message: '方案集合需使用保留父子关系的 JSON 数组，请逐行修正或使用单方案模板' }) }
      }
      else if (key === 'securityBudget') fields[key] = normalizeNumberValue(value) ?? value
      else fields[key] = value
    }

    // 1) 按 columnMap 抽取
    for (const { idx, target } of mappedCols) {
      const raw = (row[idx] ?? '').trim()
      if (target.startsWith(PRODUCT_PREFIX)) {
        hasProductColumn = true
        const product = normalizeProductCode(target.slice(PRODUCT_PREFIX.length))
        // 产品独立列采用用户确认的规则：单元格非空即表示已购。
        if (raw && product) purchasedProducts.add(product)
        continue
      }
      if (target === PROGRESS_TARGET) {
        if (raw) {
          const parsed = parseProgressCell(raw, defaultYear)
          for (const issue of parsed.issues) problems.push({ excelRow, field: `source:${idx}`, message: `进展列「${headers[idx]}」第 ${issue.line} 段：${issue.message}（${issue.text}）` })
          progress.push(...parsed.entries)
        }
        continue
      }
      if (target.startsWith(REVENUE_PREFIX)) {
        if (!raw) continue // 空跳过
        const month = target.slice(REVENUE_PREFIX.length)
        const num = Number(raw.replace(/[,，\s¥￥]/g, ''))
        if (!Number.isFinite(num)) {
          problems.push({ excelRow, field: `source:${idx}`, message: `收入列「${headers[idx]}」数值非法：「${raw}」，请修正后导入` })
          continue
        }
        const existing = revenues.find((cell) => cell.month === month)
        if (existing && existing.amount !== num) problems.push({ excelRow, field: `source:${idx}`, message: `多列映射到 ${month} 收入且值不一致，请修正原始单元格或字段映射` })
        else if (!existing) revenues.push({ month, amount: num })
        continue
      }
      if (!raw) continue
      const pending = parsePendingField(target)
      const key = pending ? `${CUSTOM_PREFIX}${pending.fieldKey}` : target
      const value = key === 'securityBudget' || pending?.fieldType === 'number' ? normalizeNumberValue(raw) ?? raw : raw
      const previous = sourceValues.get(key)
      if (previous && previous.value !== value) {
        problems.push({ excelRow, field: `source:${idx}`, message: `「${headers[previous.idx]}」与「${headers[idx]}」映射到同一字段但值冲突，请修正原始单元格或字段映射` })
        continue
      }
      sourceValues.set(key, { value, idx })
      setField(target, raw, true)
    }

    if (hasProductColumn) {
      const generic = fields.purchasedProducts
      if (Array.isArray(generic)) {
        for (const value of generic) {
          const product = normalizeProductCode(String(value))
          if (product) purchasedProducts.add(product)
        }
      } else if (generic != null) {
        for (const value of String(generic).split(/[、,，]/)) {
          const product = normalizeProductCode(value)
          if (product) purchasedProducts.add(product)
        }
      }
      fields.purchasedProducts = PRODUCT_CATALOG.filter((product) => purchasedProducts.has(product))
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
      if (rule.matchField) continue // 标准值对照在基础规则全部应用后执行。
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

    const fieldValue = (key: string) => key.startsWith(CUSTOM_PREFIX) ? customFields[key.slice(CUSTOM_PREFIX.length)] : fields[key]
    for (const rule of valueRules) {
      if (rule.type !== 'exact' || !rule.matchField) continue
      if (Object.entries(rule.when ?? {}).some(([key, value]) => String(fieldValue(key) ?? '').trim() !== value)) continue
      const raw = fieldValue(rule.matchField)
      const value = Array.isArray(raw) ? raw.join('、') : String(raw ?? '').trim()
      const hit = rule.mapping[value]
      if (hit) for (const [key, replacement] of Object.entries(hit)) setField(key, replacement, true)
    }

    // 必填项由后端合并已有项目后校验；预算错误仍给出本地提示。
    const budgetError = validateSecurityBudget(fields.securityBudget)
    if (budgetError) problems.push({ excelRow, field: 'securityBudget', message: budgetError })
    records.push({ sourceRow: excelRow, fields: fields as unknown as Partial<ProjectInput>, revenues, progress })
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
