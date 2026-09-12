import type {
  ChangeLog,
  CustomFieldDef,
  CustomFieldType,
  DictNode,
  ExportColumn,
  ExportScope,
  ExportTemplate,
  ID,
  ImportMapping,
  MonthStr,
  Paged,
  ProgressLog,
  Project,
  ProjectInput,
  Revenue,
  ValueRule,
} from '@/types'

// ============================================================
// API 契约层 —— 与 docs/API.md 对齐。
// 页面只依赖本接口；mock 与 http 两种实现可切换（VITE_API_MODE）。
// ============================================================

// ---------- 项目 ----------
export interface ProjectListQuery {
  industry?: string
  track?: string
  projectStatus?: string
  keyword?: string
  /** YYYY-MM；筛选期间有收入的项目，revenueTotal 按该期间计算 */
  startMonth?: MonthStr
  endMonth?: MonthStr
  /** 0 基页码（与后端一致） */
  page?: number
  size?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  /** true 查回收站 */
  deleted?: boolean
}

export interface ProjectDetail {
  project: Project
  /** 倒序 */
  progress: ProgressLog[]
  /** 升序 by month */
  revenues: Revenue[]
  /** 倒序 */
  changeLogs: ChangeLog[]
}

// ---------- 收入 ----------
export interface RevenueMatrixParams {
  year?: number
  startMonth?: MonthStr
  endMonth?: MonthStr
  industry?: string
  track?: string
  keyword?: string
}

export interface RevenueMatrixRow {
  projectId: ID
  customerName: string
  projectName: string
  industry: string
  track: string
  /** month -> amount（无记录则无该 key） */
  amounts: Record<MonthStr, number>
  /** 该行合计 */
  total: number
}

export interface RevenueMatrix {
  months: MonthStr[]
  rows: RevenueMatrixRow[]
}

export interface RevenueEntry {
  projectId: ID
  month: MonthStr
  /** null = 清空该单元格；0 会保留 0 元记录 */
  amount: number | null
}

export interface RevenueBatchResult {
  created: number
  updated: number
  cleared: number
  unchanged: number
}

// ---------- 统计 ----------
export type StatsDim = 'project' | 'industry' | 'month' | 'year'
export interface RevenueStatItem {
  key: string
  label: string
  amount: number
}
export interface RevenueStats {
  dimension: StatsDim
  year: number | null
  total: number
  items: RevenueStatItem[]
}

export interface DictionaryInput {
  type: string
  value: string
  parentId: ID | null
  sortOrder: number
}

export interface CustomFieldInput {
  fieldKey: string
  label: string
  fieldType: CustomFieldType
  required: boolean
  options: string[]
  sortOrder: number
}

// ---------- 导入 ----------
/** 一条导入记录（前端解析映射后组装） */
export interface ImportRecordInput {
  /** 项目字段（camelCase；customFields 为内嵌 map） */
  fields: Partial<ProjectInput>
  revenues: { month: MonthStr; amount: number }[]
  progress: { logDate: string; content: string }[]
}

export interface ImportRecordResult {
  /** 记录在请求数组中的序号（1 基） */
  row: number
  /** added / overwritten / skipped / failed */
  status: string
  projectId?: ID | null
  externalId?: string | null
  customerName?: string | null
  projectName?: string | null
  reason?: string | null
}

export interface ImportResult {
  dryRun: boolean
  mappingId: ID | null
  added: number
  overwritten: number
  skipped: number
  details: ImportRecordResult[]
}

// ---------- 导出 ----------
export interface ExportFilters {
  projectIds?: ID[]
  industry?: string
  track?: string
  keyword?: string
  startMonth?: MonthStr
  endMonth?: MonthStr
  startDate?: string
  endDate?: string
}

export interface ExportFieldOption {
  key: string
  title: string
}

export interface ExportResult {
  scope: ExportScope
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
  totalRows: number
  generatedAt: string
}

// ============================================================
export interface ApiClient {
  // 项目
  listProjects(q: ProjectListQuery): Promise<Paged<Project>>
  getProjectDetail(id: ID): Promise<ProjectDetail>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(id: ID, input: ProjectInput): Promise<Project>
  /** 软删除 */
  deleteProject(id: ID): Promise<void>
  /** 回收站恢复 */
  restoreProject(id: ID): Promise<void>

  // 进展
  addProgress(input: { projectId: ID; logDate: string; content: string }): Promise<ProgressLog>
  deleteProgress(id: ID): Promise<void>

  // 收入
  getRevenueMatrix(params: RevenueMatrixParams): Promise<RevenueMatrix>
  saveRevenues(entries: RevenueEntry[]): Promise<RevenueBatchResult>

  // 统计
  getRevenueStats(params: { dim: StatsDim; year?: number }): Promise<RevenueStats>

  // 字典（树）
  getDictionaries(type?: string): Promise<DictNode[]>
  createDictItem(input: DictionaryInput): Promise<DictNode>
  updateDictItem(id: ID, input: DictionaryInput): Promise<DictNode>
  /** 有下级或项目引用时后端返回 409 */
  deleteDictItem(id: ID): Promise<void>

  // 配置：导入映射 / 导出模板 / 自定义字段
  listImportMappings(): Promise<ImportMapping[]>
  createImportMapping(input: { name: string; columnMap: Record<string, string>; valueRules: ValueRule[] }): Promise<ImportMapping>
  updateImportMapping(id: ID, input: { name: string; columnMap: Record<string, string>; valueRules: ValueRule[] }): Promise<ImportMapping>
  deleteImportMapping(id: ID): Promise<void>

  listExportTemplates(): Promise<ExportTemplate[]>
  createExportTemplate(input: { name: string; scope: ExportScope; columns: ExportColumn[] }): Promise<ExportTemplate>
  updateExportTemplate(id: ID, input: { name: string; scope: ExportScope; columns: ExportColumn[] }): Promise<ExportTemplate>
  deleteExportTemplate(id: ID): Promise<void>

  listCustomFields(): Promise<CustomFieldDef[]>
  createCustomField(input: CustomFieldInput): Promise<CustomFieldDef>
  /** fieldKey 创建后不可改；改类型/必填/选项时后端会先校验现有数据 */
  updateCustomField(id: ID, input: CustomFieldInput): Promise<CustomFieldDef>
  /** 被项目数据引用时不可删除（409） */
  deleteCustomField(id: ID): Promise<void>

  // 导入：dryRun=true 预检（不落库），false 正式执行
  importRecords(input: { mappingId?: ID | null; dryRun: boolean; records: ImportRecordInput[] }): Promise<ImportResult>

  // 导出
  getExportFields(scope: ExportScope): Promise<ExportFieldOption[]>
  exportData(input: {
    templateId?: ID
    scope?: ExportScope
    columns?: ExportColumn[]
    filters?: ExportFilters
  }): Promise<ExportResult>

  // 一键全量备份（JSON）
  backupAll(): Promise<unknown>
}
