import { PROJECT_FIELD_DEFS } from '@/lib/fields'
import type { CustomFieldDef } from '@/types'

// ============================================================
// 管道列表列配置：基础字段 + 自定义字段，持久化 localStorage
// ============================================================

export interface PipelineColumn {
  key: string
  label: string
  defaultVisible: boolean
}

export interface ColumnState {
  key: string
  visible: boolean
}

const STORAGE_KEY = 'pipeline-columns-v1'

/** 支持排序的列（与后端 sortBy 对齐） */
const SORTABLE_KEYS = new Set(['customerName', 'projectName', 'projectStatus', 'industry', 'track', 'createdAt', 'updatedAt'])

export function isSortableColumn(key: string): boolean {
  return SORTABLE_KEYS.has(key)
}

/** 当前可用列全集：PROJECT_FIELD_DEFS + 自定义字段（key 为 custom.{fieldKey}） */
export function buildAvailableColumns(customDefs: CustomFieldDef[]): PipelineColumn[] {
  const base: PipelineColumn[] = PROJECT_FIELD_DEFS.map((f) => ({
    key: f.key,
    label: f.label,
    defaultVisible: f.defaultVisible,
  }))
  const custom: PipelineColumn[] = [...customDefs]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((d) => ({ key: `custom.${d.fieldKey}`, label: d.label, defaultVisible: true }))
  return [...base, ...custom]
}

/** 读取持久化配置并与当前可用列合并：已删除的列剔除，新增列按 defaultVisible 追加到末尾 */
export function loadColumnStates(available: PipelineColumn[]): ColumnState[] {
  let stored: ColumnState[] = []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        stored = parsed.filter(
          (s): s is ColumnState =>
            typeof s === 'object' && s !== null && typeof (s as ColumnState).key === 'string',
        )
      }
    }
  } catch {
    stored = []
  }
  const availableKeys = new Set(available.map((c) => c.key))
  const merged = stored.filter((s) => availableKeys.has(s.key))
  const present = new Set(merged.map((s) => s.key))
  for (const c of available) {
    if (!present.has(c.key)) merged.push({ key: c.key, visible: c.defaultVisible })
  }
  return merged
}

export function saveColumnStates(states: ColumnState[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states))
  } catch {
    // 隐私模式等场景写入失败，忽略
  }
}
