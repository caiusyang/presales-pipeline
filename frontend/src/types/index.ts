// ============================================================
// 领域模型 —— 与后端 DTO 对齐（见 docs/API.md 与 backend/**/dto）
// ============================================================

export type ID = number
/** 月份 YYYY-MM */
export type MonthStr = string
/** 日期 YYYY-MM-DD */
export type DateStr = string

// ---------- 项目 ----------
export interface Project {
  id: ID
  /** 外部系统编号（判重首选），可空 */
  externalId: string | null
  customerName: string
  projectName: string
  /** 安全空间 */
  safetySpace: string
  solution: string
  track: string
  industry: string
  subIndustry: string
  scenario: string
  keyRisks: string
  keyNeeds: string
  /** 自定义扩展字段值，key 为字段定义 fieldKey */
  customFields: Record<string, unknown>
  /** 后端实时汇总的累计收入（万元）；列表/详情均返回。月份区间筛选时为区间内汇总 */
  revenueTotal: number
  deleted: boolean
  createdAt: string
  updatedAt: string
}

export type ProjectInput = Omit<Project, 'id' | 'revenueTotal' | 'deleted' | 'createdAt' | 'updatedAt'>

// ---------- 收入 ----------
export interface Revenue {
  id: ID
  projectId: ID
  month: MonthStr
  /** 金额，万元 */
  amount: number
  createdAt?: string
  updatedAt?: string
}

// ---------- 进展 ----------
export interface ProgressLog {
  id: ID
  projectId: ID
  logDate: DateStr
  content: string
  createdAt: string
  updatedAt?: string
}

// ---------- 修改日志 ----------
export type ChangeSource = 'manual' | 'import' | string
export interface ChangeLog {
  id: ID
  projectId?: ID
  operator: string
  field: string
  oldValue: string
  newValue: string
  source: ChangeSource
  createdAt: string
}

// ---------- 字典（树节点；行业节点的 children 为子行业） ----------
export type DictType = 'track' | 'industry' | 'sub_industry' | 'solution' | 'safety_space' | string
export interface DictNode {
  id: ID
  type: DictType
  value: string
  parentId: ID | null
  sortOrder: number
  children?: DictNode[]
  createdAt?: string
  updatedAt?: string
}

// ---------- 自定义字段定义 ----------
export type CustomFieldType = 'text' | 'number' | 'date' | 'option'
export interface CustomFieldDef {
  id: ID
  fieldKey: string
  label: string
  fieldType: CustomFieldType
  required: boolean
  /** fieldType=option 时的候选项 */
  options: string[]
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

// ---------- 导入映射方案 ----------
/**
 * 值映射三种规则（可组合，前端在本地解析 Excel 时执行；后端仅持久化配置）：
 * - exact：精确对照表。源列值 → 一个或多个目标字段（一列拆多字段）
 * - split：分隔符拆分。源列按分隔符拆分后依次写入 targets
 * - default：固定默认值。字段为空时补常量
 */
export type ValueRule =
  | { type: 'exact'; source: string; mapping: Record<string, Record<string, string>> }
  | { type: 'split'; source: string; delimiter: string; targets: string[] }
  | { type: 'default'; field: string; value: string }

export interface ImportMapping {
  id: ID
  name: string
  /** 列名映射：Excel 列名 → 目标字段 key（'progressText' 表示进展多行文本列；'revenue:YYYY-MM' 表示某月收入列；'custom.xxx' 自定义字段） */
  columnMap: Record<string, string>
  valueRules: ValueRule[]
  createdAt: string
  updatedAt: string
}

// ---------- 导出模板 ----------
export type ExportScope = 'projects' | 'revenues' | 'progress'
export interface ExportColumn {
  key: string
  /** 导出到 Excel 的列名（可自定义为领导总表列名） */
  title: string
}
export interface ExportTemplate {
  id: ID
  name: string
  scope: ExportScope
  /** 有序列配置，数组顺序即列顺序 */
  columns: ExportColumn[]
  createdAt: string
  updatedAt: string
}

// ---------- 通用分页（前端契约；http 适配器从 Spring Page 转换） ----------
export interface Paged<T> {
  items: T[]
  total: number
}
