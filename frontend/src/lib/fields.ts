import type { DictNode, Project } from '@/types'
import { solutionSelections, solutionText } from '@/lib/solutions'
import { productName } from '@/lib/products'

// ============================================================
// 项目字段元数据：列表列配置 / 导入映射目标 / 导出列 / 详情表单共用
// ============================================================

export type ProjectFieldKey = keyof Omit<
  Project,
  'id' | 'customFields' | 'revenueTotal' | 'deleted' | 'createdAt' | 'updatedAt' | 'lastFollowUpAt' | 'hcsStatus' | 'lastSyncAt' | 'responsibles'
>

export interface ProjectFieldDef {
  key: ProjectFieldKey | 'revenueTotal' | 'lastFollowUpAt' | 'hcsStatus' | 'responsibles'
  label: string
  kind: 'text' | 'number' | 'date' | 'textarea' | 'dict' | 'status' | 'multivalue' | 'computed'
  /** kind=dict 时的字典类型；industry/subIndustry 走行业→子行业级联 */
  dict?: 'track' | 'industry' | 'solution' | 'security_direction'
  /** 列表中默认是否显示 */
  defaultVisible: boolean
  /** 是否可编辑（出现在表单/行内编辑） */
  editable: boolean
}

export const PROJECT_FIELD_DEFS: ProjectFieldDef[] = [
  { key: 'nextActionDate', label: '下次行动日期', kind: 'date', defaultVisible: true, editable: true },
  { key: 'nextActionNote', label: '下次行动内容', kind: 'textarea', defaultVisible: false, editable: true },
  { key: 'lastFollowUpAt', label: '最后跟进时间', kind: 'computed', defaultVisible: true, editable: false },
  { key: 'externalId', label: '外部编号', kind: 'text', defaultVisible: false, editable: true },
  { key: 'customerName', label: '客户名称', kind: 'text', defaultVisible: true, editable: true },
  { key: 'projectName', label: '项目名称', kind: 'text', defaultVisible: true, editable: true },
  { key: 'projectStatus', label: '本地售前状态', kind: 'status', defaultVisible: true, editable: true },
  { key: 'hcsOpportunityId', label: 'HCS机会点编号', kind: 'text', defaultVisible: false, editable: true },
  { key: 'hcsStatus', label: 'HCS状态', kind: 'computed', defaultVisible: false, editable: false },
  { key: 'responsibles', label: '责任人', kind: 'computed', defaultVisible: true, editable: false },
  { key: 'industry', label: '行业', kind: 'dict', dict: 'industry', defaultVisible: true, editable: true },
  { key: 'subIndustry', label: '子行业', kind: 'dict', dict: 'industry', defaultVisible: true, editable: true },
  { key: 'track', label: '赛道', kind: 'dict', dict: 'track', defaultVisible: true, editable: true },
  { key: 'securityDirection', label: '安全方向', kind: 'dict', dict: 'security_direction', defaultVisible: true, editable: true },
  { key: 'solutions', label: '方案集合', kind: 'multivalue', defaultVisible: true, editable: true },
  { key: 'solution', label: '解决方案（旧单方案）', kind: 'dict', dict: 'solution', defaultVisible: false, editable: true },
  { key: 'subSolution', label: '细分解决方案（旧单方案）', kind: 'dict', dict: 'solution', defaultVisible: false, editable: true },
  { key: 'purchasedProducts', label: '已购产品', kind: 'multivalue', defaultVisible: true, editable: true },
  { key: 'securityBudget', label: '客户安全预算（万元）', kind: 'number', defaultVisible: false, editable: true },
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
  if (key === 'track') return p.track || '待分类'
  if (key === 'solutions') return solutionText(solutionSelections(p))
  if (key === 'hcsStatus') return p.hcsStatus || '未同步'
  if (key === 'responsibles') return (p.responsibles ?? []).map((r) => `${r.name}（${r.source === 'hcs' ? 'HCS' : '手工'}${r.role ? ` · ${r.role}` : ''}）`).join('、')
  if (key === 'purchasedProducts') return p.purchasedProducts.map(productName).join('、')
  if (key.startsWith('custom.')) {
    const v = p.customFields?.[key.slice(7)]
    return v == null ? '' : String(v)
  }
  const v = (p as unknown as Record<string, unknown>)[key]
  if (v == null) return ''
  if (Array.isArray(v)) return v.join('、')
  return String(v)
}
export function appliesToTrack(field: { applicableTracks?: string[] }, track?: string | null) { return !field.applicableTracks?.length || field.applicableTracks.includes(track ?? '') }

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

/** 解决方案→细分解决方案→产品三级关联。 */
export function solutionCascade(solutionTree: DictNode[]): {
  solutions: DictNode[]
  subMap: Map<string, DictNode[]>
  productMap: Map<string, DictNode[]>
} {
  const solutions = [...solutionTree].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  const subMap = new Map<string, DictNode[]>()
  const productMap = new Map<string, DictNode[]>()
  for (const solution of solutions) {
    const subs = [...(solution.children ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    subMap.set(solution.value, subs)
    for (const sub of subs) {
      productMap.set(
        `${solution.value}\u0000${sub.value}`,
        [...(sub.children ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
      )
    }
  }
  return { solutions, subMap, productMap }
}
