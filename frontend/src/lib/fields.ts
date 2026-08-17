import type { DictNode, Project } from '@/types'

// ============================================================
// 项目字段元数据：列表列配置 / 导入映射目标 / 导出列 / 详情表单共用
// ============================================================

export type ProjectFieldKey = keyof Omit<
  Project,
  'id' | 'customFields' | 'revenueTotal' | 'deleted' | 'createdAt' | 'updatedAt'
>

export interface ProjectFieldDef {
  key: ProjectFieldKey | 'revenueTotal'
  label: string
  kind: 'text' | 'textarea' | 'dict' | 'computed'
  /** kind=dict 时的字典类型；industry/subIndustry 走行业→子行业级联 */
  dict?: 'track' | 'industry' | 'solution' | 'safety_space'
  /** 列表中默认是否显示 */
  defaultVisible: boolean
  /** 是否可编辑（出现在表单/行内编辑） */
  editable: boolean
}

export const PROJECT_FIELD_DEFS: ProjectFieldDef[] = [
  { key: 'externalId', label: '外部编号', kind: 'text', defaultVisible: false, editable: true },
  { key: 'customerName', label: '客户名称', kind: 'text', defaultVisible: true, editable: true },
  { key: 'projectName', label: '项目名称', kind: 'text', defaultVisible: true, editable: true },
  { key: 'industry', label: '行业', kind: 'dict', dict: 'industry', defaultVisible: true, editable: true },
  { key: 'subIndustry', label: '子行业', kind: 'dict', dict: 'industry', defaultVisible: true, editable: true },
  { key: 'track', label: '赛道', kind: 'dict', dict: 'track', defaultVisible: true, editable: true },
  { key: 'solution', label: '解决方案', kind: 'dict', dict: 'solution', defaultVisible: true, editable: true },
  { key: 'safetySpace', label: '安全空间', kind: 'text', defaultVisible: false, editable: true },
  { key: 'scenario', label: '应用场景', kind: 'textarea', defaultVisible: false, editable: true },
  { key: 'keyNeeds', label: '关键需求', kind: 'textarea', defaultVisible: false, editable: true },
  { key: 'keyRisks', label: '关键风险', kind: 'textarea', defaultVisible: false, editable: true },
  { key: 'revenueTotal', label: '累计收入(万元)', kind: 'computed', defaultVisible: true, editable: false },
]

export const PROJECT_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_FIELD_DEFS.map((f) => [f.key, f.label]),
)
/** 进展伪字段（导入映射目标用）：单元格按换行拆多条，格式 `日期：内容` */
PROJECT_FIELD_LABELS['progressText'] = '进展(多行文本)'

/** 必填字段（前端先校验再提交） */
export const REQUIRED_PROJECT_FIELDS: ProjectFieldKey[] = ['customerName', 'projectName']

/** 取项目某字段的展示值（含 computed 与 custom.xxx） */
export function getProjectFieldValue(p: Project, key: string): string {
  if (key.startsWith('custom.')) {
    const v = p.customFields?.[key.slice(7)]
    return v == null ? '' : String(v)
  }
  const v = (p as unknown as Record<string, unknown>)[key]
  if (v == null) return ''
  return String(v)
}

// ---------- 字典树工具 ----------
/** 摊平字典树为列表（先序） */
export function flattenDictTree(nodes: DictNode[]): DictNode[] {
  const out: DictNode[] = []
  const walk = (ns: DictNode[]) => {
    for (const n of ns) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

/** 行业→子行业级联：从行业字典树派生 { industries: 顶级行业, subMap: 行业值 → 子行业节点 } */
export function industryCascade(industryTree: DictNode[]): {
  industries: DictNode[]
  subMap: Map<string, DictNode[]>
} {
  const industries = [...industryTree].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  const subMap = new Map<string, DictNode[]>()
  for (const ind of industries) {
    if (ind.children?.length) {
      subMap.set(
        ind.value,
        [...ind.children].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
      )
    }
  }
  return { industries, subMap }
}
