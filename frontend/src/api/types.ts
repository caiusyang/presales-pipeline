import type {
  ChangeLog,
  CustomFieldDef,
  CustomFieldType,
  DictNode,
  DictionaryCategory,
  ExportColumn,
  ExportScope,
  ExportTemplate,
  ID,
  ImportMapping,
  MonthStr,
  Paged,
  ProgressLog,
  ProjectProductRecord,
  Project,
  ProjectInput,
  Revenue,
  ValueRule,
} from '@/types'
import type { ProductDefinition, ProductInput } from '@/lib/products'
import type { Person, PersonInput, PersonReference } from '@/lib/people'

// ============================================================
// API 契约层 —— 与 docs/API.md 对齐。
// 页面只依赖本接口；mock 与 http 两种实现可切换（VITE_API_MODE）。
// ============================================================

// ---------- 项目 ----------
export interface ProjectListQuery {
  followUpRange?: 'due'
  fixedTarget?: boolean
  projectLevel?: string
  solution?: string
  subSolution?: string
  responsibleId?: ID
  hcsStatus?: string
  actionRange?: 'overdue' | 'today' | 'next7' | 'unscheduled'
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
  /** 固定产品目录中已购产品对应的关系表记录 */
  products: ProjectProductRecord[]
  /** 升序 by month */
  revenues: Revenue[]
  /** 倒序 */
  changeLogs: ChangeLog[]
}

// ---------- 客户分析 ----------
export interface CustomerProjectSummary {
  solutions?: import('@/types').SolutionSelection[]
  id: ID
  externalId: string | null
  projectName: string
  projectStatus: string
  industry: string
  track: string
  solution: string
  subSolution: string
  purchasedProducts: string[]
  revenueTotal: number
  updatedAt: string
}

export interface CustomerAnalysis {
  customerName: string
  projectCount: number
  wonProjectCount: number
  statusCounts: Record<string, number>
  purchasedProducts: string[]
  revenueTotal: number
  updatedAt: string
  projects: CustomerProjectSummary[]
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

export interface DictionaryCategoryInput {
  type: string
  label: string
  sortOrder: number
}

export interface DictionaryImportInput {
  type: string
  parentId: ID | null
  dryRun: boolean
  records: { sourceRow: number; value: string }[]
}

export interface DictionaryImportResult {
  dryRun: boolean
  added: number
  skipped: number
  failed: number
  details: { sourceRow: number; value: string; status: 'added' | 'skipped' | 'failed'; reason?: string | null; id?: ID | null }[]
}

export interface CustomFieldInput {
  applicableTracks?: string[]
  fieldKey: string
  label: string
  fieldType: CustomFieldType
  required: boolean
  options: string[]
  dictionaryType?: string | null
  sortOrder: number
}

// ---------- 导入 ----------
/** 一条导入记录（前端解析映射后组装） */
export interface ImportRecordInput {
  sourceRow?: number
  /** 项目字段（camelCase；customFields 为内嵌 map） */
  fields: Partial<ProjectInput>
  revenues: { month: MonthStr; amount: number }[]
  progress: { logDate: string; content: string }[]
}

export interface ImportIssue { field: string; code: string; message: string }
export interface ImportFieldDefinition { fieldKey: string; label: string; fieldType: 'text' | 'number' | 'date' }

export interface ImportRecordResult {
  sourceRow?: number
  issues?: ImportIssue[]
  effectiveFields?: Partial<ProjectInput>
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
export interface BackgroundJob {
  id: string
  kind: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'INTERRUPTED'
  total: number
  processed: number
  succeeded: number
  failed: number
  error?: string | null
  createdAt: string
  updatedAt: string
}
export interface BackgroundJobItem { index: number; status: string; input: unknown; result: unknown; error?: string | null }
export interface ProgressRepairRow { id: ID; projectId: ID; projectName: string; logDate: string; content: string; createdAt: string; classification: 'repairable' | 'verified' | 'manual'; reason: string; proposedDate: string | null; proposedContent: string | null }
export interface ProgressRepairInput { id: ID; expectedLogDate: string; expectedContent: string; logDate: string; content: string; evidence: string }
export interface MigrationIssue { id: ID; projectId: ID | null; area: string; reason: string; originalValue: string | null; resolved: boolean; createdAt: string }
export interface JobApi {
  startPeopleImport(input: { requestId: string; people: PersonInput[] }): Promise<BackgroundJob>
  startProgressRepairJob(input: { requestId: string; repairs: ProgressRepairInput[] }): Promise<BackgroundJob>
  listJobs(): Promise<BackgroundJob[]>
  getJob(id: string): Promise<BackgroundJob>
  getJobItems(id: string, page?: number): Promise<{ total: number; items: BackgroundJobItem[] }>
  getJobResult(id: string): Promise<unknown>
  retryJob(id: string, requestId: string): Promise<BackgroundJob>
  startProjectBatch(input: { requestId: string; operation: 'delete' | 'restore' | 'purge'; projectIds: ID[] }): Promise<BackgroundJob>
  startImportJob(input: { requestId: string; request: { mappingId?: ID | null; dryRun: boolean; records: ImportRecordInput[]; pendingFields?: ImportFieldDefinition[] } }): Promise<BackgroundJob>
  startExportJob(input: { requestId: string; request: { templateId?: ID; scope?: ExportScope; columns?: ExportColumn[]; filters?: ExportFilters } }): Promise<BackgroundJob>
}

export interface ApiClient extends JobApi {
  getFollowUpPolicy(): Promise<import('@/lib/followUp').FollowUpPolicy>
  saveFollowUpPolicy(input: import('@/lib/followUp').FollowUpPolicy): Promise<import('@/lib/followUp').FollowUpPolicy>
  listPeople(): Promise<Person[]>
  savePerson(input: PersonInput, id?: ID): Promise<Person>
  matchPeople(input: PersonReference[]): Promise<{ personIds: ID[]; issues: string[] }>
  getSolutionStats(): Promise<SolutionStats>
  listProductCatalog(): Promise<ProductDefinition[]>
  createProduct(input: ProductInput): Promise<ProductDefinition>
  updateProduct(id: ID, input: ProductInput): Promise<ProductDefinition>
  getMigrationIssues(): Promise<MigrationIssue[]>
  previewProgressRepairs(page?: number): Promise<{ total: number; items: ProgressRepairRow[] }>
  completeAction(id: ID, input: { nextActionDate: string | null; nextActionNote: string }): Promise<Project>
  // 项目
  listProjects(q: ProjectListQuery): Promise<Paged<Project>>
  getProjectDetail(id: ID): Promise<ProjectDetail>
  createProject(input: ProjectInput): Promise<Project>
  updateProject(id: ID, input: ProjectInput): Promise<Project>
  /** 软删除 */
  deleteProject(id: ID): Promise<void>
  /** 仅回收站项目可永久删除，同时删除关联记录 */
  permanentlyDeleteProject(id: ID): Promise<void>
  /** 回收站恢复 */
  restoreProject(id: ID): Promise<void>

  // 客户分析
  listCustomers(keyword?: string): Promise<CustomerAnalysis[]>

  // 进展
  addProgress(input: { projectId: ID; logDate: string; content: string }): Promise<ProgressLog>
  deleteProgress(id: ID): Promise<void>

  // 收入
  getRevenueMatrix(params: RevenueMatrixParams): Promise<RevenueMatrix>
  saveRevenues(entries: RevenueEntry[]): Promise<RevenueBatchResult>

  // 统计
  getRevenueStats(params: { dim: StatsDim; year?: number }): Promise<RevenueStats>

  // 字典（树）
  listDictionaryCategories(): Promise<DictionaryCategory[]>
  createDictionaryCategory(input: DictionaryCategoryInput): Promise<DictionaryCategory>
  updateDictionaryCategory(id: ID, input: DictionaryCategoryInput): Promise<DictionaryCategory>
  deleteDictionaryCategory(id: ID): Promise<void>
  importDictionaryValues(input: DictionaryImportInput): Promise<DictionaryImportResult>
  getDictionaries(type?: string): Promise<DictNode[]>
  createDictItem(input: DictionaryInput): Promise<DictNode>
  updateDictItem(id: ID, input: DictionaryInput): Promise<DictNode>
  /** 有下级或项目引用时后端返回 409 */
  deleteDictItem(id: ID): Promise<void>

  // 配置：导入映射 / 导出模板 / 自定义字段
  listImportMappings(): Promise<ImportMapping[]>
  createImportMapping(input: { name: string; columnMap: Record<string, string>; valueRules: ValueRule[]; applicableTrack?: string | null }): Promise<ImportMapping>
  updateImportMapping(id: ID, input: { name: string; columnMap: Record<string, string>; valueRules: ValueRule[]; applicableTrack?: string | null }): Promise<ImportMapping>
  deleteImportMapping(id: ID): Promise<void>

  listExportTemplates(): Promise<ExportTemplate[]>
  createExportTemplate(input: { name: string; scope: ExportScope; columns: ExportColumn[]; applicableTrack?: string | null }): Promise<ExportTemplate>
  updateExportTemplate(id: ID, input: { name: string; scope: ExportScope; columns: ExportColumn[]; applicableTrack?: string | null }): Promise<ExportTemplate>
  deleteExportTemplate(id: ID): Promise<void>

  listCustomFields(): Promise<CustomFieldDef[]>
  createCustomField(input: CustomFieldInput): Promise<CustomFieldDef>
  /** fieldKey 创建后不可改；改类型/必填/选项时后端会先校验现有数据 */
  updateCustomField(id: ID, input: CustomFieldInput): Promise<CustomFieldDef>
  /** 被项目数据引用时不可删除（409） */
  deleteCustomField(id: ID): Promise<void>

  // 导入：dryRun=true 预检（不落库），false 正式执行
  importRecords(input: { mappingId?: ID | null; dryRun: boolean; records: ImportRecordInput[]; pendingFields?: ImportFieldDefinition[] }): Promise<ImportResult>

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
export interface SolutionStats {
  totalProjectCount: number
  coveredProjectCount: number
  solutionCoverageCount: number
  notice: string
  items: { id: number; solution: string; projectCount: number; customerCount: number; wonProjectCount: number; statusCounts: Record<string, number>; subSolutions: { id: number; name: string; projectCount: number; customerCount: number }[] }[]
}
