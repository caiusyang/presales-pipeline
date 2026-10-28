import type {
  ChangeLog,
  CustomFieldDef,
  DictNode,
  DictionaryCategory,
  ID,
  ImportMapping,
  ProgressLog,
  Project,
  ProjectInput,
  ProjectProductRecord,
  Revenue,
} from '@/types'
import type {
  ApiClient,
  CustomerAnalysis,
  CustomFieldInput,
  DictionaryInput,
  DictionaryImportResult,
  ExportFieldOption,
  ExportResult,
  ImportRecordInput,
  ImportRecordResult,
  ImportResult,
  ProjectDetail,
  ProjectListQuery,
  RevenueBatchResult,
  RevenueMatrix,
  RevenueMatrixRow,
  RevenueStats,
} from '@/api/types'
import { PROJECT_FIELD_LABELS, REQUIRED_PROJECT_FIELDS } from '@/lib/fields'
import { DATE_RE, MONTH_RE } from '@/lib/format'
import { normalizeProductCode, PRODUCT_CATALOG, initialProducts, productName, productDefinitions, setProductCatalog, type ProductInput } from '@/lib/products'
import { seedDB, type MockDB } from './seed'
import { validateSecurityBudget } from '@/components/project/project-utils'
import { mergeImportFields, validateImportRecord, productValues } from '@/components/impexp/importReview'
import { createMockTasks, eraseMockProjectTasks } from './jobs'
import { actionReminder, compareActions } from '@/lib/actions'
import { parseProgressCell } from '@/lib/progressDate'
import type { ProgressRepairInput, ProgressRepairRow } from '@/api/types'
import { normalizeSolutions, solutionSelections, withSolutions } from '@/lib/solutions'
import { matchPeople, type PersonInput } from '@/lib/people'

// ============================================================
// Mock 实现：在浏览器内模拟后端契约（判重 / dryRun / 修改日志 /
// 字典树级联删除保护 / 收入汇总 / SQL 式聚合），localStorage 持久化。
// ============================================================

// 保持存储 key 稳定；新增结构在 load 中补齐，保留用户演示数据。
const STORAGE_KEY = 'presales-pipeline-mock-v6'
const LATENCY = 120
const PRODUCT_EXPORT_PREFIX = 'product.'

function productExportColumns() {
  return PRODUCT_CATALOG.map((product) => ({ key: `${PRODUCT_EXPORT_PREFIX}${product}`, title: productName(product) }))
}

function expandLegacyProductColumns<T extends { key: string; title: string }>(scope: string | undefined, columns: T[]): T[] {
  if (scope !== 'combined' && scope !== 'projects') return columns
  return columns.flatMap((column) => column.key === 'purchasedProducts'
    ? productExportColumns() as T[]
    : [column])
}

function productCodeFromExportKey(key: string): string | null {
  if (!key.startsWith(PRODUCT_EXPORT_PREFIX)) return null
  const product = key.slice(PRODUCT_EXPORT_PREFIX.length)
  return PRODUCT_CATALOG.includes(product as (typeof PRODUCT_CATALOG)[number]) ? product : null
}

let db: MockDB = load()
db.productCatalog ??= initialProducts()
setProductCatalog(db.productCatalog)
for (const project of db.projects) project.solutions ??= solutionSelections(project)
db.people ??= []
let bulkExecutionCount = 0

function load(): MockDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as MockDB
      stored.projects = stored.projects.map((project) => ({
        ...project,
        projectStatus: project.projectStatus ?? '机会点识别',
        subSolution: project.subSolution ?? '',
        purchasedProducts: project.purchasedProducts ?? [],
        nextActionDate: project.nextActionDate ?? null, nextActionNote: project.nextActionNote ?? '',
        lastFollowUpAt: project.lastFollowUpAt ?? [project.createdAt, ...stored.changeLogs.filter((log) => log.projectId === project.id && log.field !== 'deleted').map((log) => log.createdAt), ...stored.progressLogs.filter((log) => log.projectId === project.id).map((log) => log.updatedAt ?? log.createdAt)].filter(Boolean).sort().at(-1) ?? project.createdAt,
      }))
      stored.exportTemplates = stored.exportTemplates.map((template) => ({
        ...template,
        columns: expandLegacyProductColumns(template.scope, template.columns),
      }))
      if (!stored.dictionaryCategories) {
        stored.dictionaryCategories = [
          { id: stored.seq++, type: 'track', label: '赛道', builtIn: true, sortOrder: 10 },
          { id: stored.seq++, type: 'industry', label: '行业', builtIn: true, sortOrder: 20 },
          { id: stored.seq++, type: 'solution', label: '方案与产品', builtIn: true, sortOrder: 30 },
        ]
        for (const type of new Set(stored.dictionaries.map((item) => item.type))) {
          if (['track', 'industry', 'sub_industry', 'solution', 'sub_solution', 'product'].includes(type)) continue
          stored.dictionaryCategories.push({ id: stored.seq++, type, label: type, builtIn: false, sortOrder: 100 })
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      }
      migrateTrackData(stored)
      return stored
    }
  } catch {
    /* 损坏则重新播种 */
  }
  const fresh = seedDB()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  return fresh
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function migrateTrackData(stored: MockDB) {
  let changed = false
  stored.migrationIssues ??= []
  for (const project of stored.projects) if (project.track && !['HCS', '公有云'].includes(project.track)) {
    stored.migrationIssues.push({ id: stored.seq++, projectId: project.id, area: 'track', reason: '旧值是安全方向，无法据此判断 HCS/公有云；请人工分类', originalValue: project.track, resolved: false, createdAt: new Date().toISOString() })
    project.securityDirection ??= project.track; project.track = ''; changed = true
  }
  for (const item of stored.dictionaries) if (item.type === 'track' && !['HCS', '公有云'].includes(item.value)) { item.type = 'security_direction'; changed = true }
  if (!stored.dictionaryCategories.some((c) => c.type === 'security_direction')) { stored.dictionaryCategories.push({ id: stored.seq++, type: 'security_direction', label: '安全方向', builtIn: true, sortOrder: 40 }); changed = true }
  for (const [index, value] of ['HCS', '公有云'].entries()) if (!stored.dictionaries.some((d) => d.type === 'track' && d.value === value)) { stored.dictionaries.push({ id: stored.seq++, type: 'track', value, parentId: null, sortOrder: (index + 1) * 10 }); changed = true }
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

function delay<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn())
      } catch (e) {
        reject(e)
      }
    }, bulkExecutionCount > 0 ? 0 : LATENCY)
  })
}

const now = () => new Date().toISOString()
const nextId = () => db.seq++
const alive = (p: Project) => !p.deleted
const norm = (s: unknown) => (s ?? '').toString().trim()
const round2 = (n: number) => Math.round(n * 100) / 100
const touchProject = (id: ID) => { const project = db.projects.find((p) => p.id === id); if (project) project.lastFollowUpAt = now() }

function saveProduct(input: ProductInput, id?: ID) {
  return delay(() => {
    const existing = db.productCatalog?.find((p) => p.id === id)
    if (id && !existing) throw new Error('产品不存在')
    const code = input.code.trim(), name = input.name.trim()
    if (!code || code.length > 64 || /[.:/,、]/.test(code) || !name || name.length > 255) throw new Error('请填写合法的稳定编码及产品名称')
    if (existing && existing.code !== code) throw new Error('产品编码创建后不可修改')
    const aliases = [...new Set(input.aliases.map((a) => a.trim()).filter(Boolean))]
    if (aliases.some((a) => a.length > 255)) throw new Error('别名最多255字符')
    if (input.applicableTracks.some((t) => !['HCS', '公有云'].includes(t))) throw new Error('适用赛道无效')
    const tokens = [code, name, ...aliases].map((s) => s.toLowerCase())
    if (db.productCatalog?.some((p) => p.id !== id && [p.code, p.name, ...p.aliases].some((s) => tokens.includes(s.toLowerCase())))) throw new Error('产品编码、名称或别名与其他产品冲突')
    const product = { ...input, id: id ?? nextId(), code, name, aliases }
    db.productCatalog = [...(db.productCatalog ?? []).filter((p) => p.id !== product.id), product]
    setProductCatalog(db.productCatalog); persist(); return structuredClone(product)
  })
}
function savePerson(input: PersonInput, id?: ID) {
  return delay(() => {
    if (id && !db.people?.some((p) => p.id === id)) throw new Error('责任人不存在')
    const name = input.name.trim(), employeeNo = input.employeeNo?.trim() || null, account = input.account?.trim() || null
    if (!name || name.length > 255 || (employeeNo?.length ?? 0) > 128 || (account?.length ?? 0) > 128) throw new Error('姓名、工号或账号格式无效')
    if (db.people?.some((p) => p.id !== id && (employeeNo && employeeNo.toLowerCase() === p.employeeNo?.toLowerCase() || account && account.toLowerCase() === p.account?.toLowerCase()))) throw new Error('工号或账号已被其他人员使用')
    const aliases = [...new Set(input.aliases.map((s) => s.trim()).filter(Boolean))]; if (aliases.length > 100 || aliases.some((a) => a.length > 255)) throw new Error('别名过多或过长')
    const person = { ...input, id: id ?? nextId(), name, employeeNo, account, aliases }
    db.people = [...(db.people ?? []).filter((p) => p.id !== person.id), person]
    // 展示名称取目录，关系编码不变。
    db.projects.forEach((p) => p.responsibles?.forEach((r) => { if (r.personId === person.id) { r.name = name; r.employeeNo = employeeNo; r.account = account } }))
    persist(); return structuredClone(person)
  })
}
function projectPeople(fields: Partial<ProjectInput>, previous?: Project) {
  const ids = [...new Set(fields.responsibleIds ?? previous?.responsibleIds ?? [])].sort((a, b) => a - b)
  if (ids.length > 100) throw new Error('最多关联100位责任人')
  const manual = ids.map((id) => { const p = db.people?.find((p) => p.id === id); if (!p || !p.enabled && !previous?.responsibleIds?.includes(id)) throw new Error(`责任人不存在或已停用：${id}`); return { personId: id, name: p.name, employeeNo: p.employeeNo, account: p.account, source: 'manual' } })
  const hcsOpportunityId = fields.hcsOpportunityId == null ? previous?.hcsOpportunityId ?? null : fields.hcsOpportunityId.trim() || null
  if (hcsOpportunityId && (hcsOpportunityId.length > 128 || db.projects.some((p) => p.id !== previous?.id && p.hcsOpportunityId === hcsOpportunityId))) throw new Error('HCS机会点编号过长或已被绑定')
  return { responsibleIds: ids, responsibles: [...(previous?.responsibles?.filter((r) => r.source === 'hcs') ?? []), ...manual], hcsOpportunityId, hcsStatus: previous?.hcsStatus ?? null, lastSyncAt: previous?.lastSyncAt ?? null }
}

function normalizeSecurityBudgetValue(value: unknown): number | null {
  const error = validateSecurityBudget(value)
  if (error) throw new Error(error)
  return value == null || String(value).trim() === '' ? null : Number(value)
}

function revenueTotalOf(projectId: ID, startMonth?: string, endMonth?: string): number {
  return round2(
    db.revenues
      .filter(
        (r) =>
          r.projectId === projectId &&
          (!startMonth || r.month >= startMonth) &&
          (!endMonth || r.month <= endMonth),
      )
      .reduce((s, r) => s + r.amount, 0),
  )
}

/** 字段级修改日志 */
function diffAndLog(projectId: ID, before: Project, after: ProjectInput, source: 'manual' | 'import') {
  const previousCount = db.changeLogs.length
  if (before.customerName !== after.customerName || before.projectName !== after.projectName || before.externalId !== after.externalId) {
    const identity = (p: Partial<ProjectInput>) => JSON.stringify({ customerName: p.customerName, projectName: p.projectName, externalId: p.externalId })
    db.changeLogs.push({ id: nextId(), projectId, operator: '我', field: 'projectIdentity', oldValue: identity(before), newValue: identity(after), source, createdAt: now() })
  }
  if (JSON.stringify(solutionSelections(before)) !== JSON.stringify(solutionSelections(after))) db.changeLogs.push({ id: nextId(), projectId, operator: '我', field: 'solutions', oldValue: JSON.stringify(solutionSelections(before)), newValue: JSON.stringify(solutionSelections(after)), source, createdAt: now() })
  const fields: (keyof ProjectInput)[] = [
    'externalId', 'customerName', 'projectName', 'projectStatus', 'securityBudget', 'solution', 'subSolution',
    'purchasedProducts', 'track',
    'industry', 'subIndustry', 'scenario', 'keyRisks', 'keyNeeds', 'nextActionDate', 'nextActionNote', 'securityDirection',
    'responsibleIds', 'hcsOpportunityId',
  ]
  for (const f of fields) {
    const ov = norm(before[f])
    const nv = norm(after[f])
    if (ov !== nv) {
      db.changeLogs.push({ id: nextId(), projectId, operator: '我', field: f, oldValue: ov, newValue: nv, source, createdAt: now() })
    }
  }
  const keys = new Set([...Object.keys(before.customFields ?? {}), ...Object.keys(after.customFields ?? {})])
  for (const k of keys) {
    const ov = norm(before.customFields?.[k])
    const nv = norm(after.customFields?.[k])
    if (ov !== nv) {
      db.changeLogs.push({ id: nextId(), projectId, operator: '我', field: `custom.${k}`, oldValue: ov, newValue: nv, source, createdAt: now() })
    }
  }
  if (db.changeLogs.length !== previousCount) before.lastFollowUpAt = now()
}

function validateProjectFields(fields: Partial<ProjectInput>, previous?: Project) {
  if (fields.track && !['HCS', '公有云'].includes(fields.track)) throw new Error('赛道固定为 HCS、公有云；安全方向须单独填写')
  if (fields.nextActionDate && (!DATE_RE.test(fields.nextActionDate) || parseProgressCell(`${fields.nextActionDate}：日期校验`).issues.length)) throw new Error('下次行动日期无效')
  for (const f of REQUIRED_PROJECT_FIELDS) {
    if (!norm(fields[f])) throw new Error(`必填字段缺失：${PROJECT_FIELD_LABELS[f] ?? f}`)
  }
  const budgetError = validateSecurityBudget(fields.securityBudget)
  if (budgetError) throw new Error(budgetError)
  const invalidProduct = (fields.purchasedProducts ?? []).find((product) => !normalizeProductCode(product))
  if (invalidProduct) throw new Error(`已购产品只能是：${PRODUCT_CATALOG.join('、')}`)
  for (const code of fields.purchasedProducts ?? []) {
    if (previous?.purchasedProducts.includes(code)) continue
    const product = productDefinitions().find((p) => p.code === normalizeProductCode(code))!
    if (!product.enabled || product.applicableTracks.length && !product.applicableTracks.includes(fields.track ?? '')) throw new Error(`产品已停用或不适用当前赛道：${product.name}`)
  }
  if (fields.projectStatus === '中标') {
    if (!solutionSelections(fields).length) throw new Error('中标时必须确认解决方案')
    if (!solutionSelections(fields).some((s) => s.subSolutions.length)) throw new Error('中标时必须确认细分解决方案')
    if (!fields.purchasedProducts?.length) throw new Error('中标时至少选择一个已购产品')
  }
  validateCustomValues(fields.customFields ?? {}, effectiveCustomFieldDefs(), fields.track)
}

function effectiveCustomFieldDefs(): CustomFieldDef[] {
  return db.customFieldDefs.map((def) => ({ ...def, options: def.dictionaryType
    ? db.dictionaries.filter((item) => item.type === def.dictionaryType)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map((item) => item.value)
    : [...def.options] }))
}

function validateCustomValues(values: ProjectInput['customFields'], definitions: CustomFieldDef[], track?: string) {
  for (const def of definitions) {
    if (def.applicableTracks?.length && !def.applicableTracks.includes(track ?? '')) continue
    const value = norm(values?.[def.fieldKey])
    if (!value) {
      if (def.required) throw new Error(`${def.label}为必填项`)
      continue
    }
    if (def.fieldType === 'option' && !def.options.includes(value)) throw new Error(`${def.label}不在可选项中：${value}`)
    if (def.fieldType === 'number' && !Number.isFinite(Number(value))) throw new Error(`${def.label}必须为数字`)
    if (def.fieldType === 'date' && (!DATE_RE.test(value) || Number.isNaN(Date.parse(value)))) throw new Error(`${def.label}必须为有效日期`)
  }
}

function prepareCustomField(input: CustomFieldInput, validateExisting = false): Omit<CustomFieldDef, 'id'> {
  const dictionaryType = norm(input.dictionaryType) || null
  if (dictionaryType && input.fieldType !== 'option') throw new Error('只有选项字段可以关联字典')
  if (dictionaryType && !db.dictionaryCategories.some((c) => c.type === dictionaryType && !c.builtIn)) throw new Error('关联的自定义字典不存在')
  const options = [...new Set(input.options.map(norm).filter(Boolean))]
  const effective = dictionaryType ? db.dictionaries.filter((d) => d.type === dictionaryType).map((d) => d.value) : options
  if (input.fieldType === 'option' && !effective.length && (!dictionaryType || input.required)) throw new Error('选项类型需提供候选项，必填字段关联的字典不能为空')
  const candidate = { ...input, label: norm(input.label), dictionaryType, options: dictionaryType ? [] : options }
  if (input.applicableTracks?.some((t) => !['HCS', '公有云'].includes(t))) throw new Error('适用赛道只能选择 HCS、公有云')
  if (validateExisting) for (const project of db.projects) validateCustomValues(project.customFields, [{ ...candidate, id: 0, options: effective }], project.track)
  return candidate
}

function dictionaryValue(input: DictionaryInput, existingId?: ID): string {
  if (input.type === 'track' && !['HCS', '公有云'].includes(input.value.trim())) throw new Error('赛道固定为 HCS、公有云；安全方向请使用安全方向字典')
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(input.type)) throw new Error('字典编码格式不正确')
  const value = input.type === 'product' ? normalizeProductCode(input.value) : norm(input.value)
  if (!value) throw new Error(input.type === 'product' ? `已购产品只能是：${PRODUCT_CATALOG.join('、')}` : '字典值不能为空')
  if (value.length > 255) throw new Error('字典值不能超过255个字符')
  const expectedParent = ({ sub_industry: 'industry', sub_solution: 'solution', product: 'sub_solution' } as Record<string, string>)[input.type]
  const parent = db.dictionaries.find((d) => d.id === input.parentId)
  if (expectedParent ? parent?.type !== expectedParent : input.parentId != null) throw new Error(expectedParent ? '请选择正确的父级字典项' : '此字典不支持下级或父级')
  if (db.dictionaries.some((d) => d.id !== existingId && d.type === input.type && d.parentId === input.parentId && d.value.toLowerCase() === value.toLowerCase())) throw new Error('同级下已存在同名字典项')
  return value
}

function ensureCustomCategory(type: string) {
  if (['track', 'industry', 'sub_industry', 'solution', 'sub_solution', 'product'].includes(type)) return
  if (!db.dictionaryCategories.some((c) => c.type === type)) db.dictionaryCategories.push({ id: nextId(), type, label: type, builtIn: false, sortOrder: 100 })
}

/** 字典平铺 → 树 */
function buildTree(items: DictNode[]): DictNode[] {
  const build = (parentId: ID | null): DictNode[] => items
      .filter((d) => d.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((d) => {
        const children = build(d.id)
        return { ...d, ...(children.length ? { children } : {}) }
      })
  return build(null)
}

function dictUsageCount(item: DictNode): number {
  return db.projects.filter((p) => {
    if (item.type === 'track') return p.track === item.value
    if (item.type === 'security_direction') return p.securityDirection === item.value
    if (item.type === 'solution') return solutionSelections(p).some((s) => s.solution === item.value)
    if (item.type === 'sub_solution') return solutionSelections(p).some((s) => s.subSolutions.includes(item.value) && db.dictionaries.some((parent) => parent.id === item.parentId && parent.value === s.solution))
    if (item.type === 'product') return p.purchasedProducts.includes(item.value)
    if (item.type === 'industry') return p.industry === item.value
    if (item.type === 'sub_industry') return p.subIndustry === item.value
    return db.customFieldDefs.some((def) => def.dictionaryType === item.type && norm(p.customFields[def.fieldKey]) === item.value)
  }).length
}

export const mockApi: ApiClient = {
  listPeople: () => delay(() => structuredClone(db.people ?? [])),
  savePerson,
  matchPeople: (input) => delay(() => matchPeople(db.people ?? [], input)),
  startPeopleImport: (input) => mockTasks.startPeopleImport(input),
  getSolutionStats() { return delay(() => {
    const projects = db.projects.filter(alive), covered = new Set<number>()
    const items = db.dictionaries.filter((d) => d.type === 'solution').map((d) => {
      const matches = projects.filter((p) => solutionSelections(p).some((s) => s.solution === d.value)); matches.forEach((p) => covered.add(p.id))
      const statusCounts: Record<string, number> = {}; matches.forEach((p) => { statusCounts[p.projectStatus] = (statusCounts[p.projectStatus] ?? 0) + 1 })
      const subSolutions = db.dictionaries.filter((sub) => sub.parentId === d.id && sub.type === 'sub_solution').map((sub) => { const children = matches.filter((p) => solutionSelections(p).some((s) => s.solution === d.value && s.subSolutions.includes(sub.value))); return { id: sub.id, name: sub.value, projectCount: children.length, customerCount: new Set(children.map((p) => p.customerName.toLowerCase())).size } }).filter((s) => s.projectCount)
      return { id: d.id, solution: d.value, projectCount: matches.length, customerCount: new Set(matches.map((p) => p.customerName.toLowerCase())).size, wonProjectCount: statusCounts['中标'] ?? 0, statusCounts, subSolutions }
    }).filter((s) => s.projectCount)
    return { totalProjectCount: projects.length, coveredProjectCount: covered.size, solutionCoverageCount: items.reduce((sum, s) => sum + s.projectCount, 0), items, notice: '方案覆盖数可能大于项目总数；一级和细分方案内分别按项目去重，不分摊收入' }
  }) },
  listProductCatalog() { return delay(() => structuredClone(db.productCatalog ?? [])) },
  async createProduct(input) { return saveProduct(input) },
  async updateProduct(id, input) { return saveProduct(input, id) },
  getMigrationIssues: () => delay(() => (db.migrationIssues ?? []).filter((i) => !i.resolved).map((i) => ({ ...i }))),
  previewProgressRepairs(page = 0) {
    return delay(() => { const logs = db.progressLogs.filter((log) => db.projects.some((p) => p.id === log.projectId && alive(p))).sort((a, b) => a.id - b.id); return { total: logs.length, items: logs.slice(page * 100, (page + 1) * 100).map((log): ProgressRepairRow => { const parsed = parseProgressCell(log.content); const candidate = !parsed.issues.length && parsed.entries.length === 1 ? parsed.entries[0] : null; return { ...log, projectName: db.projects.find((p) => p.id === log.projectId)!.projectName, classification: candidate ? candidate.logDate === log.logDate ? 'verified' : 'repairable' : 'manual', reason: candidate ? '已识别原文完整日期' : '原文无法确定完整日期，不自动修改', proposedDate: candidate?.logDate ?? null, proposedContent: candidate?.content ?? null } }) } })
  },
  startProgressRepairJob: (input) => mockTasks.startProgressRepairJob(input),
  completeAction(id, input) {
    return delay(() => { const project = db.projects.find((p) => p.id === id && alive(p)); if (!project) throw new Error('项目不存在'); const after = { ...project, ...input }; validateProjectFields(after, project); diffAndLog(id, project, after, 'manual'); Object.assign(project, input); persist(); return { ...project, revenueTotal: revenueTotalOf(id) } })
  },
  listJobs: () => mockTasks.listJobs(),
  getJob: (id) => mockTasks.getJob(id),
  getJobItems: (id, page) => mockTasks.getJobItems(id, page),
  getJobResult: (id) => mockTasks.getJobResult(id),
  retryJob: (id, requestId) => mockTasks.retryJob(id, requestId),
  startProjectBatch: (input) => mockTasks.startProjectBatch(input),
  startImportJob: (input) => mockTasks.startImportJob(input),
  startExportJob: (input) => mockTasks.startExportJob(input),
  // ---------------- 项目 ----------------
  listProjects(q: ProjectListQuery) {
    return delay(() => {
      let list = db.projects.filter((p) => (q.deleted ? p.deleted : alive(p)))
      if (q.industry) list = list.filter((p) => p.industry === q.industry)
      if (q.track) list = list.filter((p) => q.track === '__unclassified__' ? !p.track : p.track === q.track)
      if (q.projectStatus) list = list.filter((p) => p.projectStatus === q.projectStatus)
      if (q.hcsStatus) list = list.filter((p) => p.hcsStatus === q.hcsStatus)
      if (q.responsibleId) list = list.filter((p) => p.responsibles?.some((r) => r.personId === q.responsibleId))
      if (q.solution || q.subSolution) list = list.filter((p) => solutionSelections(p).some((s) => (!q.solution || s.solution === q.solution) && (!q.subSolution || s.subSolutions.includes(q.subSolution))))
      if (q.actionRange) list = list.filter((p) => { const reminder = actionReminder(p.nextActionDate); return q.actionRange === 'overdue' ? reminder.group === 0 : q.actionRange === 'today' ? reminder.group === 1 : q.actionRange === 'unscheduled' ? reminder.group === 3 : reminder.days != null && reminder.days > 0 && reminder.days <= 7 })
      if (q.keyword) {
        const kw = q.keyword.toLowerCase()
        list = list.filter(
          (p) =>
            p.customerName.toLowerCase().includes(kw) ||
            p.projectName.toLowerCase().includes(kw) ||
            (p.externalId ?? '').toLowerCase().includes(kw),
        )
      }
      if (q.startMonth || q.endMonth) {
        const inRange = new Set(
          db.revenues
            .filter((r) => (!q.startMonth || r.month >= q.startMonth) && (!q.endMonth || r.month <= q.endMonth))
            .map((r) => r.projectId),
        )
        list = list.filter((p) => inRange.has(p.id))
      }
      const withRev: Project[] = list.map((p) => ({
        ...p,
        revenueTotal: revenueTotalOf(p.id, q.startMonth, q.endMonth),
      }))
      const sortBy = q.sortBy ?? 'actionPriority'
      const dir = q.sortDirection === 'asc' ? 1 : -1
      withRev.sort((a, b) => {
        if (sortBy === 'actionPriority') return compareActions(a, b)
        const av = (a as unknown as Record<string, unknown>)[sortBy]
        const bv = (b as unknown as Record<string, unknown>)[sortBy]
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        return String(av ?? '').localeCompare(String(bv ?? ''), 'zh') * dir
      })
      const page = q.page ?? 0
      const size = q.size ?? 50
      return { items: withRev.slice(page * size, (page + 1) * size), total: withRev.length }
    })
  },

  getProjectDetail(id) {
    return delay(() => {
      const project = db.projects.find((p) => p.id === id)
      if (!project) throw new Error('项目不存在')
      const detail: ProjectDetail = {
        project: { ...project, revenueTotal: revenueTotalOf(id) },
        progress: db.progressLogs
          .filter((l) => l.projectId === id)
          .sort((a, b) => (a.logDate === b.logDate ? b.id - a.id : b.logDate.localeCompare(a.logDate))),
        products: (project.purchasedProducts ?? []).map((productCode, index): ProjectProductRecord => ({
          id: project.id * 100 + index + 1,
          projectId: project.id,
          productCode,
          createdAt: project.updatedAt,
          updatedAt: project.updatedAt,
        })),
        revenues: db.revenues.filter((r) => r.projectId === id).sort((a, b) => a.month.localeCompare(b.month)),
        changeLogs: db.changeLogs
          .filter((c) => c.projectId === id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id),
      }
      return detail
    })
  },

  createProject(input) {
    return delay(() => {
      validateProjectFields(input)
      const normalized = withSolutions(input, normalizeSolutions(solutionSelections(input)))
      const issues = validateImportRecord({ fields: normalized, revenues: [], progress: [] }, db.dictionaries, effectiveCustomFieldDefs())
      if (issues.length) throw new Error(issues[0].message)
      const p: Project = {
        ...normalized, ...projectPeople(input), purchasedProducts: input.purchasedProducts.map((p) => normalizeProductCode(p)!),
        securityBudget: normalizeSecurityBudgetValue(input.securityBudget),
        id: nextId(), revenueTotal: 0, deleted: false, createdAt: now(), updatedAt: now(), lastFollowUpAt: now(),
      }
      db.projects.push(p)
      persist()
      return { ...p }
    })
  },

  updateProject(id, input) {
    return delay(() => {
      const idx = db.projects.findIndex((p) => p.id === id)
      if (idx < 0) throw new Error('项目不存在')
      const before = db.projects[idx]
      validateProjectFields(input, before)
      const normalizedInput = withSolutions({ ...input, ...projectPeople(input, before), purchasedProducts: input.purchasedProducts.map((p) => normalizeProductCode(p)!), securityBudget: normalizeSecurityBudgetValue(input.securityBudget) }, normalizeSolutions(solutionSelections(input)))
      const issues = validateImportRecord({ fields: normalizedInput, revenues: [], progress: [] }, db.dictionaries, effectiveCustomFieldDefs(), [], before)
      if (issues.length) throw new Error(issues[0].message)
      diffAndLog(id, before, normalizedInput, 'manual')
      db.projects[idx] = { ...before, ...normalizedInput, lastFollowUpAt: before.lastFollowUpAt, updatedAt: now() }
      if (input.track) db.migrationIssues?.filter((issue) => issue.projectId === id && issue.area === 'track').forEach((issue) => { issue.resolved = true })
      persist()
      return { ...db.projects[idx], revenueTotal: revenueTotalOf(id) }
    })
  },

  deleteProject(id) {
    return delay(() => {
      const p = db.projects.find((p) => p.id === id && alive(p))
      if (!p) throw new Error('项目不存在或已删除')
      p.deleted = true
      p.updatedAt = now()
      persist()
    })
  },

  permanentlyDeleteProject(id) {
    return delay(() => {
      const project = db.projects.find((item) => item.id === id)
      if (!project) throw new Error('回收站中未找到该项目')
      if (!project.deleted) throw new Error('仅允许永久删除回收站中的项目，请先移入回收站')
      if (db.tasks) {
        const aliases = db.changeLogs.filter((log) => log.projectId === id && log.field === 'projectIdentity').flatMap((log) => [log.oldValue, log.newValue].flatMap((value) => { try { return value ? [JSON.parse(value)] : [] } catch { return [] } }))
        eraseMockProjectTasks(db.tasks, project, db.progressLogs.filter((item) => item.projectId === id).map((item) => item.id), aliases)
      }
      db.migrationIssues = db.migrationIssues?.filter((item) => item.projectId !== id)
      db.revenues = db.revenues.filter((item) => item.projectId !== id)
      db.progressLogs = db.progressLogs.filter((item) => item.projectId !== id)
      // 演示模式的产品记录由项目 purchasedProducts 生成，随主表一起移除。
      db.changeLogs = db.changeLogs.filter((item) => item.projectId !== id)
      db.projects = db.projects.filter((item) => item.id !== id)
      persist()
    })
  },

  restoreProject(id) {
    return delay(() => {
      const p = db.projects.find((p) => p.id === id && p.deleted)
      if (!p) throw new Error('回收站中未找到该项目')
      const dup = db.projects.find(
        (x) => alive(x) && norm(x.customerName) === norm(p.customerName) && norm(x.projectName) === norm(p.projectName),
      )
      if (dup) throw new Error('已存在同客户同名的活动项目，无法恢复')
      p.deleted = false
      p.updatedAt = now()
      persist()
    })
  },

  // ---------------- 客户分析 ----------------
  listCustomers(keyword) {
    return delay(() => {
      const groups = new Map<string, Project[]>()
      for (const project of db.projects.filter(alive)) {
        const key = project.customerName.toLowerCase()
        groups.set(key, [...(groups.get(key) ?? []), project])
      }
      const needle = norm(keyword).toLowerCase()
      return [...groups.values()]
        .map((projects): CustomerAnalysis => {
          const customerName = projects[0].customerName
          const products = PRODUCT_CATALOG.filter((product) =>
            projects.some((project) => project.purchasedProducts.includes(product)))
          const statusCounts = Object.fromEntries(
            ['机会点识别', '方案引导', '方案设计', '中标'].map((status) => [
              status,
              projects.filter((project) => project.projectStatus === status).length,
            ]),
          )
          const summaries = projects
            .map((project) => ({
              id: project.id,
              externalId: project.externalId,
              projectName: project.projectName,
              projectStatus: project.projectStatus,
              industry: project.industry,
              track: project.track,
              solution: project.solution,
              subSolution: project.subSolution,
              solutions: solutionSelections(project),
              purchasedProducts: project.purchasedProducts,
              revenueTotal: revenueTotalOf(project.id),
              updatedAt: project.updatedAt,
            }))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          return {
            customerName,
            projectCount: projects.length,
            wonProjectCount: statusCounts.中标,
            statusCounts,
            purchasedProducts: products,
            revenueTotal: round2(summaries.reduce((sum, project) => sum + project.revenueTotal, 0)),
            updatedAt: summaries[0].updatedAt,
            projects: summaries,
          }
        })
        .filter((customer) => !needle
          || customer.customerName.toLowerCase().includes(needle)
          || customer.purchasedProducts.some((product) => product.toLowerCase().includes(needle))
          || customer.projects.some((project) => project.projectName.toLowerCase().includes(needle)
            || (project.externalId ?? '').toLowerCase().includes(needle)))
        .sort((a, b) => b.revenueTotal - a.revenueTotal || a.customerName.localeCompare(b.customerName, 'zh'))
    })
  },

  // ---------------- 进展 ----------------
  addProgress(input) {
    return delay(() => {
      if (!DATE_RE.test(input.logDate) || parseProgressCell(`${input.logDate}：日期校验`).issues.length) throw new Error('日期格式或实际日期无效')
      if (!norm(input.content)) throw new Error('进展内容不能为空')
      const log: ProgressLog = { id: nextId(), projectId: input.projectId, logDate: input.logDate, content: input.content.trim(), createdAt: now() }
      db.progressLogs.push(log)
      touchProject(input.projectId)
      persist()
      return { ...log }
    })
  },

  deleteProgress(id) {
    return delay(() => {
      const removed = db.progressLogs.find((log) => log.id === id)
      if (removed) touchProject(removed.projectId)
      db.progressLogs = db.progressLogs.filter((l) => l.id !== id)
      persist()
    })
  },

  // ---------------- 收入 ----------------
  getRevenueMatrix({ year, startMonth, endMonth, industry, track, keyword }) {
    return delay(() => {
      let months: string[]
      if (year) {
        months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
      } else {
        const all = [...new Set(db.revenues.map((r) => r.month))].sort()
        months = all.filter((m) => (!startMonth || m >= startMonth) && (!endMonth || m <= endMonth))
      }
      let list = db.projects.filter(alive)
      if (industry) list = list.filter((p) => p.industry === industry)
      if (track) list = list.filter((p) => p.track === track)
      if (keyword) {
        const kw = keyword.toLowerCase()
        list = list.filter((p) => p.customerName.toLowerCase().includes(kw) || p.projectName.toLowerCase().includes(kw))
      }
      const rows: RevenueMatrixRow[] = list.map((p) => {
        const amounts: Record<string, number> = {}
        for (const r of db.revenues) {
          if (r.projectId === p.id && months.includes(r.month)) amounts[r.month] = r.amount
        }
        const total = round2(Object.values(amounts).reduce((s, v) => s + v, 0))
        return { projectId: p.id, customerName: p.customerName, projectName: p.projectName, industry: p.industry, track: p.track, amounts, total }
      })
      rows.sort((a, b) => a.customerName.localeCompare(b.customerName, 'zh'))
      const matrix: RevenueMatrix = { months, rows }
      return matrix
    })
  },

  saveRevenues(entries) {
    return delay(() => {
      const projectIds = [...new Set(entries.map((entry) => entry.projectId))]
      const before = new Map(projectIds.map((id) => [id, JSON.stringify(db.revenues.filter((r) => r.projectId === id))]))
      const seen = new Set<string>()
      const result: RevenueBatchResult = { created: 0, updated: 0, cleared: 0, unchanged: 0 }
      for (const e of entries) {
        if (!MONTH_RE.test(e.month)) throw new Error(`月份格式错误：${e.month}`)
        if (e.amount != null && (Number.isNaN(e.amount) || e.amount < 0)) throw new Error('金额必须为非负数值')
        const key = `${e.projectId}:${e.month}`
        if (seen.has(key)) throw new Error('同批不得重复提交同一项目月份')
        seen.add(key)
        const existing = db.revenues.find((r) => r.projectId === e.projectId && r.month === e.month)
        if (e.amount == null) {
          if (existing) {
            db.revenues = db.revenues.filter((r) => r.id !== existing.id)
            result.cleared++
            db.changeLogs.push({ id: nextId(), projectId: e.projectId, operator: '我', field: `revenue:${e.month}`, oldValue: String(existing.amount), newValue: '', source: 'manual', createdAt: now() })
          } else result.unchanged++
          continue
        }
        if (existing) {
          if (existing.amount !== round2(e.amount)) {
            db.changeLogs.push({ id: nextId(), projectId: e.projectId, operator: '我', field: `revenue:${e.month}`, oldValue: String(existing.amount), newValue: String(e.amount), source: 'manual', createdAt: now() })
            existing.amount = round2(e.amount)
            result.updated++
          } else result.unchanged++
        } else {
          db.revenues.push({ id: nextId(), projectId: e.projectId, month: e.month, amount: round2(e.amount) })
          db.changeLogs.push({ id: nextId(), projectId: e.projectId, operator: '我', field: `revenue:${e.month}`, oldValue: '', newValue: String(e.amount), source: 'manual', createdAt: now() })
          result.created++
        }
      }
      for (const id of projectIds) if (before.get(id) !== JSON.stringify(db.revenues.filter((r) => r.projectId === id))) touchProject(id)
      persist()
      return result
    })
  },

  // ---------------- 统计 ----------------
  getRevenueStats({ dim, year }) {
    return delay(() => {
      const revs = db.revenues.filter((r) => {
        const p = db.projects.find((pp) => pp.id === r.projectId)
        if (!p || !alive(p)) return false
        if (year && !r.month.startsWith(String(year))) return false
        return true
      })
      const buckets = new Map<string, { label: string; amount: number }>()
      for (const r of revs) {
        const p = db.projects.find((pp) => pp.id === r.projectId)!
        let key: string
        let label: string
        if (dim === 'project') {
          key = String(p.id)
          label = `${p.customerName}·${p.projectName}`
        } else if (dim === 'industry') {
          key = p.industry || '未填写'
          label = key
        } else if (dim === 'month') {
          key = r.month
          label = r.month
        } else {
          key = r.month.slice(0, 4)
          label = key
        }
        const b = buckets.get(key) ?? { label, amount: 0 }
        b.amount += r.amount
        buckets.set(key, b)
      }
      const items = [...buckets.entries()].map(([key, b]) => ({ key, label: b.label, amount: round2(b.amount) }))
      if (dim === 'month' || dim === 'year') items.sort((a, b) => a.key.localeCompare(b.key))
      else items.sort((a, b) => b.amount - a.amount)
      const stats: RevenueStats = {
        dimension: dim,
        year: year ?? null,
        total: round2(items.reduce((s, i) => s + i.amount, 0)),
        items,
      }
      return stats
    })
  },

  // ---------------- 字典 ----------------
  listDictionaryCategories() {
    return delay(() => db.dictionaryCategories.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map((c) => ({ ...c })))
  },
  createDictionaryCategory(input) {
    return delay(() => {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(input.type)) throw new Error('字典编码格式不正确')
      if (['track', 'industry', 'sub_industry', 'solution', 'sub_solution', 'product'].includes(input.type)
        || db.dictionaryCategories.some((c) => c.type === input.type)) throw new Error('字典编码已存在或为系统保留编码')
      const label = norm(input.label)
      if (!label || label.length > 255) throw new Error('字典名称不能为空且不能超过255个字符')
      const category: DictionaryCategory = { id: nextId(), ...input, label, builtIn: false, createdAt: now(), updatedAt: now() }
      db.dictionaryCategories.push(category)
      persist()
      return { ...category }
    })
  },
  updateDictionaryCategory(id, input) {
    return delay(() => {
      const category = db.dictionaryCategories.find((c) => c.id === id)
      if (!category) throw new Error('字典不存在')
      if (category.builtIn) throw new Error('系统字典不允许修改分类')
      if (input.type !== category.type) throw new Error('字典编码创建后不可修改')
      const label = norm(input.label)
      if (!label || label.length > 255) throw new Error('字典名称不能为空且不能超过255个字符')
      Object.assign(category, { label, sortOrder: input.sortOrder, updatedAt: now() })
      persist()
      return { ...category }
    })
  },
  deleteDictionaryCategory(id) {
    return delay(() => {
      const category = db.dictionaryCategories.find((c) => c.id === id)
      if (!category) throw new Error('字典不存在')
      if (category.builtIn) throw new Error('系统字典不可删除')
      if (db.dictionaries.some((d) => d.type === category.type)) throw new Error('请先删除该字典的全部字典值')
      if (db.customFieldDefs.some((def) => def.dictionaryType === category.type)) throw new Error('该字典已被自定义字段关联，禁止删除')
      db.dictionaryCategories = db.dictionaryCategories.filter((c) => c.id !== id)
      persist()
    })
  },
  importDictionaryValues(input) {
    return delay(() => {
      if (!input.records.length || input.records.length > 5000) throw new Error('请提供1至5000行字典值')
      const result: DictionaryImportResult = { dryRun: input.dryRun, added: 0, skipped: 0, failed: 0, details: [] }
      const seen = new Set<string>(db.dictionaries.filter((d) => d.type === input.type && d.parentId === input.parentId).map((d) => d.value.toLowerCase()))
      let sortOrder = Math.max(0, ...db.dictionaries.filter((d) => d.type === input.type && d.parentId === input.parentId).map((d) => d.sortOrder))
      for (const record of input.records) {
        let value = norm(record.value)
        try {
          if (!db.dictionaryCategories.some((c) => c.type === input.type) && !['sub_industry', 'sub_solution', 'product'].includes(input.type)) throw new Error('字典不存在')
          if (!Number.isInteger(record.sourceRow) || record.sourceRow < 1) throw new Error('源行号必须为正整数')
          // Validate parent/type/value independently of existing duplicates.
          value = dictionaryValue({ type: input.type, parentId: input.parentId, value, sortOrder },
            db.dictionaries.find((d) => d.type === input.type && d.parentId === input.parentId && d.value.toLowerCase() === value.toLowerCase())?.id)
          if (seen.has(value.toLowerCase())) {
            result.skipped++
            result.details.push({ ...record, value, status: 'skipped', reason: '同级已存在或本批次重复' })
            continue
          }
          seen.add(value.toLowerCase())
          const item: DictNode | null = input.dryRun ? null : { id: nextId(), type: input.type, value, parentId: input.parentId, sortOrder: sortOrder += 10, createdAt: now(), updatedAt: now() }
          if (item) db.dictionaries.push(item)
          result.added++
          result.details.push({ ...record, value, status: 'added', ...(item ? { id: item.id } : {}) })
        } catch (error) {
          result.failed++
          result.details.push({ ...record, value, status: 'failed', reason: (error as Error).message })
        }
      }
      if (!input.dryRun) persist()
      return result
    })
  },
  getDictionaries(type?: string) {
    return delay(() => {
      const items = db.dictionaries.filter((d) => {
        if (!type) return true
        if (type === 'industry') return d.type === 'industry' || d.type === 'sub_industry'
        if (type === 'solution') return ['solution', 'sub_solution', 'product'].includes(d.type)
        return d.type === type
      })
      // type=sub_industry 单独查询时按 parentId 挂到空树外的平铺（返回顶层为空则平铺返回）
      const tree = buildTree(items.filter((d) => d.type !== 'sub_industry' || type === 'industry' || !type))
      if (type && type !== 'industry' && type !== 'solution') {
        return items
          .filter((d) => d.type === type)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
          .map((d) => ({ ...d }))
      }
      return tree
    })
  },

  createDictItem(input) {
    return delay(() => {
      const value = dictionaryValue(input)
      if (input.type === 'track' && !['HCS', '公有云'].includes(value)) throw new Error('赛道固定为 HCS、公有云')
      ensureCustomCategory(input.type)
      const item: DictNode = { id: nextId(), type: input.type, value, parentId: input.parentId ?? null, sortOrder: input.sortOrder, createdAt: now(), updatedAt: now() }
      db.dictionaries.push(item)
      persist()
      return { ...item }
    })
  },

  updateDictItem(id, input) {
    return delay(() => {
      const item = db.dictionaries.find((d) => d.id === id)
      if (!item) throw new Error('字典项不存在')
      if (input.type !== item.type) throw new Error('字典类型不可修改')
      if (item.type === 'track' && input.value !== item.value) throw new Error('固定赛道不可改名')
      const nextValue = dictionaryValue(input, id)
      if (item.type === 'product' && input.value !== undefined && norm(input.value) !== item.value) {
        throw new Error('固定产品编码不可重命名，请删除后重新关联')
      }
      // 改名同步引用并写日志（对齐后端行为）
      if (input.value !== undefined && norm(input.value) !== item.value) {
        const nv = nextValue
        for (const p of db.projects) {
          const field =
            item.type === 'track' ? 'track'
            : item.type === 'security_direction' ? 'securityDirection'
            : item.type === 'solution' ? 'solution'
            : item.type === 'sub_solution' ? 'subSolution'
            : item.type === 'industry' ? 'industry'
            : item.type === 'sub_industry' ? 'subIndustry'
            : null
          if (field && (p as unknown as Record<string, unknown>)[field] === item.value) {
            touchProject(p.id)
            db.changeLogs.push({ id: nextId(), projectId: p.id, operator: '我', field, oldValue: item.value, newValue: nv, source: 'manual', createdAt: now() })
            ;(p as unknown as Record<string, unknown>)[field] = nv
          }
          if (item.type === 'product' && p.purchasedProducts.includes(item.value)) {
            p.purchasedProducts = p.purchasedProducts.map((product) => product === item.value ? nv : product)
            db.changeLogs.push({ id: nextId(), projectId: p.id, operator: '我', field: 'purchasedProducts', oldValue: item.value, newValue: nv, source: 'manual', createdAt: now() })
          }
          for (const def of db.customFieldDefs.filter((d) => d.dictionaryType === item.type)) {
            if (norm(p.customFields[def.fieldKey]) !== item.value) continue
            p.customFields = { ...p.customFields, [def.fieldKey]: nv }
            touchProject(p.id)
            p.updatedAt = now()
            db.changeLogs.push({ id: nextId(), projectId: p.id, operator: '我', field: `custom.${def.fieldKey}`, oldValue: item.value, newValue: nv, source: 'manual', createdAt: now() })
          }
        }
        item.value = nv
      }
      if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder
      if (input.parentId !== undefined) item.parentId = input.parentId
      item.updatedAt = now()
      persist()
      return { ...item }
    })
  },

  deleteDictItem(id) {
    return delay(() => {
      const item = db.dictionaries.find((d) => d.id === id)
      if (!item) throw new Error('字典项不存在')
      if (item.type === 'track') throw new Error('固定赛道不能删除')
      const children = db.dictionaries.filter((d) => d.parentId === id)
      if (children.length) throw new Error(`请先删除其下 ${children.length} 个子项`)
      const used = dictUsageCount(item)
      if (used) throw new Error(`该字典项被 ${used} 个项目引用，禁止删除`)
      if (db.customFieldDefs.some((def) => def.dictionaryType === item.type && def.required)
        && db.dictionaries.filter((d) => d.type === item.type).length === 1) throw new Error('必填字段关联的字典需保留至少一个字典值')
      db.dictionaries = db.dictionaries.filter((d) => d.id !== id)
      persist()
    })
  },

  // ---------------- 配置：导入映射 ----------------
  listImportMappings() {
    return delay(() => db.importMappings.map((m) => ({ ...m })))
  },
  createImportMapping(input) {
    return delay(() => {
      const m: ImportMapping = { id: nextId(), ...input, createdAt: now(), updatedAt: now() }
      db.importMappings.push(m)
      persist()
      return { ...m }
    })
  },
  updateImportMapping(id, input) {
    return delay(() => {
      const m = db.importMappings.find((x) => x.id === id)
      if (!m) throw new Error('映射方案不存在')
      m.name = input.name
      m.columnMap = input.columnMap
      m.valueRules = input.valueRules
      m.updatedAt = now()
      persist()
      return { ...m }
    })
  },
  deleteImportMapping(id) {
    return delay(() => {
      db.importMappings = db.importMappings.filter((m) => m.id !== id)
      persist()
    })
  },

  // ---------------- 配置：导出模板 ----------------
  listExportTemplates() {
    return delay(() => db.exportTemplates.map((t) => ({
      ...t,
      columns: expandLegacyProductColumns(t.scope, t.columns),
    })))
  },
  createExportTemplate(input) {
    return delay(() => {
      const t = {
        id: nextId(),
        ...input,
        columns: expandLegacyProductColumns(input.scope, input.columns),
        createdAt: now(),
        updatedAt: now(),
      }
      db.exportTemplates.push(t)
      persist()
      return { ...t, columns: [...t.columns] }
    })
  },
  updateExportTemplate(id, input) {
    return delay(() => {
      const t = db.exportTemplates.find((x) => x.id === id)
      if (!t) throw new Error('模板不存在')
      t.name = input.name
      t.scope = input.scope
      t.columns = expandLegacyProductColumns(input.scope, input.columns)
      t.updatedAt = now()
      persist()
      return { ...t, columns: [...t.columns] }
    })
  },
  deleteExportTemplate(id) {
    return delay(() => {
      db.exportTemplates = db.exportTemplates.filter((t) => t.id !== id)
      persist()
    })
  },

  // ---------------- 配置：自定义字段 ----------------
  listCustomFields() {
    return delay(() =>
      effectiveCustomFieldDefs().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    )
  },
  createCustomField(input) {
    return delay(() => {
      if (!/^[a-z][a-z0-9_]{0,63}$/.test(input.fieldKey)) throw new Error('fieldKey 只能使用小写字母、数字和下划线，且必须以字母开头')
      if (db.customFieldDefs.some((d) => d.fieldKey === input.fieldKey)) throw new Error(`字段 key 已存在：${input.fieldKey}`)
      const prepared = prepareCustomField(input)
      const def: CustomFieldDef = { id: nextId(), ...prepared, createdAt: now(), updatedAt: now() }
      db.customFieldDefs.push(def)
      persist()
      return effectiveCustomFieldDefs().find((d) => d.id === def.id)!
    })
  },
  updateCustomField(id, input) {
    return delay(() => {
      const def = db.customFieldDefs.find((d) => d.id === id)
      if (!def) throw new Error('字段定义不存在')
      if (def.fieldKey !== input.fieldKey) throw new Error('字段编码创建后不可修改')
      Object.assign(def, prepareCustomField(input, true), { updatedAt: now() })
      persist()
      return effectiveCustomFieldDefs().find((d) => d.id === def.id)!
    })
  },
  deleteCustomField(id) {
    return delay(() => {
      const def = db.customFieldDefs.find((d) => d.id === id)
      if (!def) throw new Error('字段定义不存在')
      const used = db.projects.filter((p) => norm(p.customFields?.[def.fieldKey]) !== '').length
      if (used) throw new Error(`该字段被 ${used} 个项目的数据引用，不可删除`)
      db.customFieldDefs = db.customFieldDefs.filter((d) => d.id !== id)
      persist()
    })
  },

  // ---------------- 导入 ----------------
  importRecords({ mappingId = null, dryRun, records, pendingFields = [] }) {
    return delay(() => {
      const details: ImportRecordResult[] = []
      const seen = new Set<string>()
      let added = 0, overwritten = 0, skipped = 0
      records.forEach((rec, i) => {
        const find = (p: Project) => norm(rec.fields.externalId)
          && norm(p.externalId).toLowerCase() === norm(rec.fields.externalId).toLowerCase()
        const existing = db.projects.find((p) => alive(p) && find(p))
          ?? db.projects.find((p) => alive(p) && norm(rec.fields.customerName) && norm(rec.fields.projectName)
            && norm(p.customerName).toLowerCase() === norm(rec.fields.customerName).toLowerCase()
            && norm(p.projectName).toLowerCase() === norm(rec.fields.projectName).toLowerCase())
        const fields = mergeImportFields(rec.fields, existing)
        const issues = validateImportRecord({ ...rec, fields }, db.dictionaries, effectiveCustomFieldDefs(), pendingFields, existing)
        let peopleFields: ReturnType<typeof projectPeople> | undefined
        try { peopleFields = projectPeople(fields, existing) } catch (e) { issues.push({ field: 'responsibleIds', code: 'option', message: (e as Error).message }) }
        if (db.projects.some((p) => p.deleted && find(p))) issues.push({ field: 'externalId', code: 'conflict', message: '外部编号对应的项目在回收站中，请先恢复后再导入' })
        if (db.projects.some((p) => p.id !== existing?.id && alive(p)
          && norm(p.customerName).toLowerCase() === norm(fields.customerName).toLowerCase()
          && norm(p.projectName).toLowerCase() === norm(fields.projectName).toLowerCase())) issues.push({ field: 'projectName', code: 'conflict', message: '同一客户下已存在同名项目' })
        const identifiers = [
          ...(norm(fields.externalId) ? ['ext:' + norm(fields.externalId).toLowerCase()] : []),
          'name:' + norm(fields.customerName).toLowerCase() + '\\0' + norm(fields.projectName).toLowerCase(),
          ...(existing ? ['id:' + existing.id] : []),
        ]
        if (identifiers.some((id) => seen.has(id))) issues.push({ field: '_record', code: 'duplicate', message: '同批次重复记录，仅处理首次通过校验的记录' })
        const base = { row: i + 1, sourceRow: rec.sourceRow, projectId: existing?.id ?? null,
          externalId: fields.externalId, customerName: fields.customerName, projectName: fields.projectName, effectiveFields: fields }
        if (issues.length) {
          skipped++
          details.push({ ...base, status: 'skipped', reason: issues.map((issue) => issue.message).join('；'), issues })
          return
        }
        identifiers.forEach((id) => seen.add(id))
        if (!dryRun) {
          let sortOrder = Math.max(0, ...db.customFieldDefs.map((def) => def.sortOrder))
          for (const field of pendingFields) {
            if (!Object.hasOwn(fields.customFields ?? {}, field.fieldKey) || db.customFieldDefs.some((def) => def.fieldKey === field.fieldKey)) continue
            db.customFieldDefs.push({ ...field, id: nextId(), required: false, options: [], sortOrder: sortOrder += 10 })
          }
          const normalized = { ...fields, securityBudget: normalizeSecurityBudgetValue(fields.securityBudget),
            purchasedProducts: productValues(fields.purchasedProducts).map((p) => normalizeProductCode(p)!), solutions: normalizeSolutions(solutionSelections(fields)), ...peopleFields } as ProjectInput
          if (existing) {
            diffAndLog(existing.id, existing, normalized, 'import')
            Object.assign(existing, normalized, { updatedAt: now(), lastFollowUpAt: existing.lastFollowUpAt })
            attachSubRows(existing.id, rec)
          } else {
            const project: Project = { ...normalized, externalId: normalized.externalId ?? null,
              solution: normalized.solution ?? '', subSolution: normalized.subSolution ?? '', track: normalized.track ?? '',
              industry: normalized.industry ?? '', subIndustry: normalized.subIndustry ?? '', scenario: normalized.scenario ?? '',
              keyRisks: normalized.keyRisks ?? '', keyNeeds: normalized.keyNeeds ?? '',
              id: nextId(), revenueTotal: 0, deleted: false, createdAt: now(), updatedAt: now(), lastFollowUpAt: now() }
            db.projects.push(project)
            base.projectId = project.id
            attachSubRows(project.id, rec)
          }
        }
        if (existing) overwritten++
        else added++
        details.push({ ...base, status: existing ? 'overwritten' : 'added', issues: [] })
      })
      if (!dryRun) persist()
      return { dryRun, mappingId, added, overwritten, skipped, details }
    })
  },

  // ---------------- 导出 ----------------
  getExportFields(scope) {
    return delay(() => {
      if (scope === 'combined') {
        const base: ExportFieldOption[] = [
          { key: 'id', title: '项目ID' },
          ...Object.entries(PROJECT_FIELD_LABELS)
            .filter(([key]) => key !== 'progressText' && key !== 'revenueTotal' && key !== 'purchasedProducts')
            .map(([key, title]) => ({ key, title })),
        ]
        const productIndex = base.findIndex((field) => field.key === 'subSolution') + 1
        base.splice(productIndex, 0, ...productExportColumns())
        const activeProjectIds = new Set(db.projects.filter(alive).map((project) => project.id))
        const revenueMonths = [...new Set(db.revenues
          .filter((revenue) => activeProjectIds.has(revenue.projectId))
          .map((revenue) => revenue.month))].sort()
        const revenues = revenueMonths.map((month) => ({
          key: `revenue.${month}`,
          title: `${month}收入（万元）`,
        }))
        const custom = db.customFieldDefs.map((definition) => ({
          key: `custom.${definition.fieldKey}`,
          title: definition.label,
        }))
        return [
          ...base,
          ...revenues,
          { key: 'revenueTotal', title: '收入合计（万元）' },
          { key: 'progressSummary', title: '进展日志（日期：内容）' },
          { key: 'createdAt', title: '创建时间' },
          { key: 'updatedAt', title: '更新时间' },
          ...custom,
        ]
      }
      if (scope === 'projects') {
        const base: ExportFieldOption[] = Object.entries(PROJECT_FIELD_LABELS)
          .filter(([k]) => k !== 'progressText' && k !== 'purchasedProducts')
          .map(([key, title]) => ({ key, title }))
        const productIndex = base.findIndex((field) => field.key === 'subSolution') + 1
        base.splice(productIndex, 0, ...productExportColumns())
        const custom = db.customFieldDefs.map((d) => ({ key: `custom.${d.fieldKey}`, title: d.label }))
        return [...base, ...custom]
      }
      if (scope === 'revenues') {
        return [
          { key: 'customerName', title: '客户名称' },
          { key: 'projectName', title: '项目名称' },
          { key: 'industry', title: '行业' },
          { key: 'track', title: '赛道' },
          { key: 'month', title: '月份' },
          { key: 'amount', title: '金额(万元)' },
        ]
      }
      return [
        { key: 'customerName', title: '客户名称' },
        { key: 'projectName', title: '项目名称' },
        { key: 'industry', title: '行业' },
        { key: 'logDate', title: '日期' },
        { key: 'content', title: '进展内容' },
      ]
    })
  },

  exportData({ templateId, scope, columns, filters }) {
    return delay(() => {
      let cols = columns
      let scp = scope
      if (templateId) {
        const t = db.exportTemplates.find((x) => x.id === templateId)
        if (!t) throw new Error('模板不存在')
        cols = t.columns
        scp = t.scope
      }
      if (!scp || !cols?.length) throw new Error('请指定导出范围与列配置')
      cols = expandLegacyProductColumns(scp, cols)
      const f = filters ?? {}
      const rows: Record<string, unknown>[] = []
      if (scp === 'combined') {
        let list = db.projects.filter(alive)
        if (f.industry) list = list.filter((project) => project.industry === f.industry)
        if (f.track) list = list.filter((project) => project.track === f.track)
        if (f.keyword) {
          const keyword = f.keyword.toLowerCase()
          list = list.filter((project) => project.customerName.toLowerCase().includes(keyword)
            || project.projectName.toLowerCase().includes(keyword))
        }
        if (f.projectIds?.length) list = list.filter((project) => f.projectIds!.includes(project.id))
        for (const project of list) {
          const monthlyRevenue = new Map(db.revenues
            .filter((revenue) => revenue.projectId === project.id)
            .filter((revenue) => !f.startMonth || revenue.month >= f.startMonth)
            .filter((revenue) => !f.endMonth || revenue.month <= f.endMonth)
            .map((revenue) => [revenue.month, revenue.amount]))
          const progressSummary = db.progressLogs
            .filter((log) => log.projectId === project.id)
            .filter((log) => !f.startMonth || log.logDate.slice(0, 7) >= f.startMonth)
            .filter((log) => !f.endMonth || log.logDate.slice(0, 7) <= f.endMonth)
            .filter((log) => !f.startDate || log.logDate >= f.startDate)
            .filter((log) => !f.endDate || log.logDate <= f.endDate)
            .sort((a, b) => b.logDate.localeCompare(a.logDate) || b.id - a.id)
            .map((log) => `${log.logDate}：${log.content}`)
            .join('\n')
          rows.push(Object.fromEntries(cols.map((column) => {
            const productCode = productCodeFromExportKey(column.key)
            if (productCode) {
              return [column.key, project.purchasedProducts.includes(productCode) ? '已购' : '']
            }
            if (column.key.startsWith('revenue.')) {
              return [column.key, monthlyRevenue.get(column.key.slice('revenue.'.length)) ?? null]
            }
            if (column.key === 'revenueTotal') {
              return [column.key, revenueTotalOf(project.id, f.startMonth, f.endMonth)]
            }
            if (column.key === 'progressSummary') return [column.key, progressSummary]
            if (column.key === 'solutions') return [column.key, JSON.stringify(solutionSelections(project))]
            if (column.key === 'responsibles') return [column.key, project.responsibles?.map((r) => `${r.name}（${r.source}${r.role ? ` / ${r.role}` : ''}）`).join('、') ?? '']
            if (column.key.startsWith('custom.')) {
              return [column.key, project.customFields?.[column.key.slice('custom.'.length)] ?? null]
            }
            const value = (project as unknown as Record<string, unknown>)[column.key]
            return [column.key, Array.isArray(value) ? value.join('、') : value ?? null]
          })))
        }
      } else if (scp === 'projects') {
        let list = db.projects.filter(alive)
        if (f.industry) list = list.filter((p) => p.industry === f.industry)
        if (f.track) list = list.filter((p) => p.track === f.track)
        if (f.keyword) {
          const kw = f.keyword.toLowerCase()
          list = list.filter((p) => p.customerName.toLowerCase().includes(kw) || p.projectName.toLowerCase().includes(kw))
        }
        if (f.projectIds?.length) list = list.filter((p) => f.projectIds!.includes(p.id))
        for (const p of list) {
          rows.push(
            Object.fromEntries(
              cols.map((c) => {
                const productCode = productCodeFromExportKey(c.key)
                if (productCode) return [c.key, p.purchasedProducts.includes(productCode) ? '已购' : '']
                if (c.key === 'solutions') return [c.key, JSON.stringify(solutionSelections(p))]
                if (c.key === 'responsibles') return [c.key, p.responsibles?.map((r) => `${r.name}（${r.source}）`).join('、') ?? '']
                if (c.key === 'revenueTotal') return [c.key, revenueTotalOf(p.id, f.startMonth, f.endMonth)]
                if (c.key.startsWith('custom.')) return [c.key, p.customFields?.[c.key.slice(7)] ?? null]
                return [c.key, (p as unknown as Record<string, unknown>)[c.key] ?? null]
              }),
            ),
          )
        }
      } else if (scp === 'revenues') {
        for (const r of db.revenues) {
          const p = db.projects.find((pp) => pp.id === r.projectId)
          if (!p || !alive(p)) continue
          if (f.projectIds?.length && !f.projectIds.includes(p.id)) continue
          if (f.industry && p.industry !== f.industry) continue
          if (f.track && p.track !== f.track) continue
          if (f.startMonth && r.month < f.startMonth) continue
          if (f.endMonth && r.month > f.endMonth) continue
          const flat: Record<string, unknown> = {
            customerName: p.customerName, projectName: p.projectName, industry: p.industry,
            track: p.track, month: r.month, amount: r.amount,
          }
          rows.push(Object.fromEntries(cols.map((c) => [c.key, flat[c.key] ?? null])))
        }
      } else {
        for (const l of db.progressLogs) {
          const p = db.projects.find((pp) => pp.id === l.projectId)
          if (!p || !alive(p)) continue
          if (f.projectIds?.length && !f.projectIds.includes(p.id)) continue
          if (f.startMonth && l.logDate.slice(0, 7) < f.startMonth) continue
          if (f.endMonth && l.logDate.slice(0, 7) > f.endMonth) continue
          if (f.startDate && l.logDate < f.startDate) continue
          if (f.endDate && l.logDate > f.endDate) continue
          const flat: Record<string, unknown> = {
            customerName: p.customerName, projectName: p.projectName, industry: p.industry,
            logDate: l.logDate, content: l.content,
          }
          rows.push(Object.fromEntries(cols.map((c) => [c.key, flat[c.key] ?? null])))
        }
      }
      const result: ExportResult = { scope: scp, columns: cols, rows, totalRows: rows.length, generatedAt: now() }
      return result
    })
  },

  backupAll() {
    return delay(() => JSON.parse(JSON.stringify(db)) as unknown)
  },
}

const mockTasks = createMockTasks({
  state: () => db.tasks ??= { jobs: [] }, save: persist,
  enter: () => { bulkExecutionCount++ }, leave: () => { bulkExecutionCount-- },
  execute: async (kind, input, payload) => {
    if (kind === 'PEOPLE_IMPORT') {
      const person = input as PersonInput
      const matches = (db.people ?? []).filter((p) => person.employeeNo?.trim() && person.employeeNo.trim().toLowerCase() === p.employeeNo?.toLowerCase() || person.account?.trim() && person.account.trim().toLowerCase() === p.account?.toLowerCase())
      const candidates = matches.length || person.employeeNo?.trim() || person.account?.trim() ? matches : (db.people ?? []).filter((p) => p.name === person.name.trim())
      if (candidates.length > 1) throw new Error('姓名或唯一标识存在歧义，请逐项确认')
      const saved = await savePerson(person, candidates[0]?.id); return { id: saved.id, name: saved.name }
    }
    if (kind.startsWith('PROJECT_')) {
      const id = input as number
      if (kind === 'PROJECT_DELETE') await mockApi.deleteProject(id)
      else if (kind === 'PROJECT_RESTORE') await mockApi.restoreProject(id)
      else await mockApi.permanentlyDeleteProject(id)
      return { id }
    }
    if (kind === 'EXPORT') return mockApi.exportData(input as Parameters<typeof mockApi.exportData>[0])
    if (kind === 'PROGRESS_REPAIR') {
      const repair = input as ProgressRepairInput, log = db.progressLogs.find((l) => l.id === repair.id)
      if (!log || !db.projects.some((p) => p.id === log.projectId && alive(p))) throw new Error('进展或项目已删除')
      if (log.logDate !== repair.expectedLogDate || log.content !== repair.expectedContent) throw new Error('进展已变化，请重新预览')
      if (!repair.evidence.trim() || !repair.content.trim() || parseProgressCell(`${repair.logDate}：校验`).issues.length) throw new Error('日期、内容或修复依据无效')
      if (log.logDate !== repair.logDate || log.content !== repair.content) { db.changeLogs.push({ id: nextId(), projectId: log.projectId, field: `progress.${log.id}`, oldValue: `${log.logDate}：${log.content}`, newValue: `${repair.logDate}：${repair.content}\n修复依据：${repair.evidence}`, operator: '我', source: 'manual', createdAt: now() }); log.logDate = repair.logDate; log.content = repair.content; log.updatedAt = now(); touchProject(log.projectId); persist() }
      return { id: log.id }
    }
    const request = payload as Parameters<typeof mockApi.importRecords>[0]
    const result = await mockApi.importRecords({ ...request, dryRun: kind === 'PREFLIGHT', records: [input as ImportRecordInput] })
    return result.details[0]
  },
  prepareExport: (payload) => {
    const request = payload as Parameters<typeof mockApi.exportData>[0], filters = request.filters ?? {}
    const ids = db.projects.filter(alive).filter((p) => (!filters.projectIds?.length || filters.projectIds.includes(p.id)) && (!filters.industry || p.industry === filters.industry) && (!filters.track || p.track === filters.track) && (!filters.keyword || `${p.customerName} ${p.projectName}`.toLowerCase().includes(filters.keyword.toLowerCase()))).map((p) => p.id)
    const chunks = []
    for (let start = 0; start < ids.length; start += 100) { const projectIds = ids.slice(start, start + 100); chunks.push({ input: { ...request, filters: { ...filters, projectIds } }, weight: projectIds.length }) }
    return chunks.length ? chunks : [{ input: { ...request, filters: { ...filters, projectIds: [-1] } }, weight: 0 }]
  },
})

/** 导入时挂接收入与进展子记录（upsert / 去重） */
function attachSubRows(projectId: ID, rec: ImportRecordInput) {
  for (const rv of rec.revenues ?? []) {
    if (!MONTH_RE.test(rv.month)) continue
    const existing = db.revenues.find((r) => r.projectId === projectId && r.month === rv.month)
    if (existing) { if (existing.amount !== round2(rv.amount)) { db.changeLogs.push({ id: nextId(), projectId, operator: '我', field: `revenue:${rv.month}`, oldValue: String(existing.amount), newValue: String(rv.amount), source: 'import', createdAt: now() }); existing.amount = round2(rv.amount); touchProject(projectId) } }
    else { db.revenues.push({ id: nextId(), projectId, month: rv.month, amount: round2(rv.amount) }); touchProject(projectId) }
  }
  for (const pl of rec.progress ?? []) {
    const dup = db.progressLogs.find(
      (l) => l.projectId === projectId && l.logDate === pl.logDate && l.content === pl.content,
    )
    if (!dup) {
      touchProject(projectId)
      db.progressLogs.push({ id: nextId(), projectId, logDate: pl.logDate, content: pl.content, createdAt: now() })
    }
  }
}
