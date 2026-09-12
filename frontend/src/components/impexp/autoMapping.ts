import { PROJECT_FIELD_DEFS } from '@/lib/fields'
import type { CustomFieldDef, CustomFieldType } from '@/types'
import {
  NEW_FIELD_PREFIX,
  normalizeDateValue,
  normalizeNumberValue,
  PROGRESS_TARGET,
  REVENUE_SENTINEL,
  type ColumnTarget,
  type PendingCustomField,
} from './importTransform'

export type InferredFieldType = Extract<CustomFieldType, 'text' | 'number' | 'date'>

const FIELD_ALIASES: Record<string, string[]> = {
  externalId: ['外部编号', '外部系统编号', '项目编号', '编号'],
  customerName: ['客户名称', '客户名', '客户'],
  projectName: ['项目名称', '项目名', '项目'],
  projectStatus: ['项目状态', '状态'],
  safetySpace: ['安全空间'],
  solution: ['解决方案', '方案'],
  subSolution: ['细分解决方案', '子解决方案'],
  purchasedProducts: ['已购产品', '购买产品', '产品'],
  track: ['赛道'],
  industry: ['行业'],
  subIndustry: ['子行业', '细分行业'],
  scenario: ['应用场景', '场景'],
  keyNeeds: ['关键需求', '需求'],
  keyRisks: ['关键风险', '风险'],
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-—–·:：()（）【】\[\]]+/g, '')
}

function headerCandidates(header: string): string[] {
  const parts = header.split(/\s*[/／>]\s*/).filter(Boolean)
  return [...new Set([header, parts.at(-1) ?? header].map(normalizedName))]
}

function hashLabel(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function proposedFieldKey(label: string, used: Set<string>): string {
  const tail = label.split(/\s*[/／>]\s*/).at(-1) ?? label
  let slug = tail
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36)
  if (slug && !/^[a-z]/.test(slug)) slug = `col_${slug}`
  const base = `excel_${slug ? `${slug}_` : ''}${hashLabel(label)}`.slice(0, 60)
  let key = base
  let suffix = 2
  while (used.has(key)) {
    key = `${base.slice(0, 60)}_${suffix}`
    suffix += 1
  }
  used.add(key)
  return key
}

export function inferColumnType(values: string[]): InferredFieldType {
  const samples = values.map((value) => value.trim()).filter(Boolean)
  if (samples.length === 0) return 'text'
  if (samples.every((value) => normalizeDateValue(value) != null)) return 'date'
  if (samples.every((value) => normalizeNumberValue(value) != null)) return 'number'
  return 'text'
}

function revenueMonth(header: string): string | null {
  const tail = header.split(/\s*[/／>]\s*/).at(-1) ?? header
  const match = tail.match(/(?:^|\D)(20\d{2})[-/.年](0?[1-9]|1[0-2])(?:月|\D|$)/)
  return match ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}` : null
}

export function autoMapColumns(headers: string[], rows: string[][], customDefs: CustomFieldDef[]): ColumnTarget[] {
  const known = new Map<string, string>()
  for (const field of PROJECT_FIELD_DEFS.filter((item) => item.editable)) {
    for (const name of [field.key, field.label, ...(FIELD_ALIASES[field.key] ?? [])]) {
      known.set(normalizedName(name), field.key)
    }
  }
  for (const def of customDefs) {
    known.set(normalizedName(def.fieldKey), `custom.${def.fieldKey}`)
    known.set(normalizedName(def.label), `custom.${def.fieldKey}`)
  }
  for (const alias of ['进展', '进展记录', '进展内容']) known.set(normalizedName(alias), PROGRESS_TARGET)

  const usedTargets = new Set<string>()
  const usedFieldKeys = new Set(customDefs.map((def) => def.fieldKey))
  return headers.map((header, columnIndex) => {
    const existing = headerCandidates(header)
      .map((candidate) => known.get(candidate))
      .find((target) => target != null && !usedTargets.has(target))
    if (existing) {
      usedTargets.add(existing)
      return { target: existing, month: '' }
    }
    const month = revenueMonth(header)
    if (month) {
      const target = `revenue:${month}`
      if (!usedTargets.has(target)) {
        usedTargets.add(target)
        return { target: REVENUE_SENTINEL, month }
      }
    }
    const field: PendingCustomField = {
      fieldKey: proposedFieldKey(header, usedFieldKeys),
      label: header.slice(0, 255),
      fieldType: inferColumnType(rows.map((row) => row[columnIndex] ?? '')),
    }
    return { target: `${NEW_FIELD_PREFIX}${field.fieldType}:${field.fieldKey}`, month: '', pendingField: field }
  })
}

export function pendingFieldsFromTargets(targets: ColumnTarget[]): PendingCustomField[] {
  const unique = new Map<string, PendingCustomField>()
  for (const target of targets) {
    if (target.pendingField && target.target.startsWith(NEW_FIELD_PREFIX)) {
      unique.set(target.pendingField.fieldKey, target.pendingField)
    }
  }
  return [...unique.values()]
}
