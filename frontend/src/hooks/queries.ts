import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api'
import type {
  CustomFieldType,
  DictNode,
  ExportColumn,
  ExportScope,
  ID,
  ImportMapping,
  MonthStr,
  ProjectInput,
  ValueRule,
} from '@/types'
import type {
  ExportFilters,
  ImportRecordInput,
  ProjectListQuery,
  RevenueEntry,
  RevenueMatrixParams,
  StatsDim,
} from '@/api/types'

// ============================================================
// TanStack Query hooks：页面统一通过这里取数/变更，不直接调 api
// ============================================================

export const qk = {
  projects: (q: ProjectListQuery) => ['projects', q] as const,
  projectDetail: (id: ID) => ['project-detail', id] as const,
  revenueMatrix: (params: RevenueMatrixParams) => ['revenue-matrix', params] as const,
  stats: (dim: StatsDim, year?: number) => ['stats', dim, year] as const,
  dicts: (type?: string) => ['dicts', type ?? 'all'] as const,
  mappings: () => ['import-mappings'] as const,
  templates: () => ['export-templates'] as const,
  customFields: () => ['custom-fields'] as const,
  exportFields: (scope: ExportScope) => ['export-fields', scope] as const,
}

const onErr = (e: unknown) => toast.error((e as Error).message || '操作失败')

// ---------------- 项目 ----------------
export function useProjects(q: ProjectListQuery) {
  return useQuery({ queryKey: qk.projects(q), queryFn: () => api.listProjects(q) })
}

export function useProjectDetail(id: ID | null) {
  return useQuery({
    queryKey: qk.projectDetail(id ?? 0),
    queryFn: () => api.getProjectDetail(id!),
    enabled: id != null,
  })
}

export function useProjectMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['project-detail'] })
    qc.invalidateQueries({ queryKey: ['revenue-matrix'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }
  const create = useMutation({
    mutationFn: (input: ProjectInput) => api.createProject(input),
    onSuccess: () => { invalidate(); toast.success('项目已创建') },
    onError: onErr,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: ID; input: ProjectInput }) => api.updateProject(id, input),
    onSuccess: () => { invalidate(); toast.success('已保存') },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id: ID) => api.deleteProject(id),
    onSuccess: () => { invalidate(); toast.success('已删除（移入回收站）') },
    onError: onErr,
  })
  const restore = useMutation({
    mutationFn: (id: ID) => api.restoreProject(id),
    onSuccess: () => { invalidate(); toast.success('已恢复') },
    onError: onErr,
  })
  return { create, update, remove, restore }
}

// ---------------- 进展 ----------------
export function useProgressMutations(projectId: ID) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.projectDetail(projectId) })
  const add = useMutation({
    mutationFn: (input: { logDate: string; content: string }) => api.addProgress({ projectId, ...input }),
    onSuccess: () => { invalidate(); toast.success('进展已记录') },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id: ID) => api.deleteProgress(id),
    onSuccess: () => { invalidate(); toast.success('进展已删除') },
    onError: onErr,
  })
  return { add, remove }
}

// ---------------- 收入 ----------------
export function useRevenueMatrix(params: RevenueMatrixParams) {
  return useQuery({
    queryKey: qk.revenueMatrix(params),
    queryFn: () => api.getRevenueMatrix(params),
  })
}

export function useSaveRevenues() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entries: RevenueEntry[]) => api.saveRevenues(entries),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['revenue-matrix'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['project-detail'] })
      toast.success(`收入已保存：新增 ${r.created} / 更新 ${r.updated} / 清空 ${r.cleared}`)
    },
    onError: onErr,
  })
}

// ---------------- 统计 ----------------
export function useRevenueStats(dim: StatsDim, year?: number) {
  return useQuery({ queryKey: qk.stats(dim, year), queryFn: () => api.getRevenueStats({ dim, year }) })
}

// ---------------- 字典 ----------------
/** type 省略时返回全部类型的树（行业带子行业 children） */
export function useDictionaries(type?: string) {
  return useQuery({ queryKey: qk.dicts(type), queryFn: () => api.getDictionaries(type) })
}

export function useDictMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dicts'] })
    qc.invalidateQueries({ queryKey: ['projects'] }) // 改名会同步项目引用
    qc.invalidateQueries({ queryKey: ['project-detail'] })
  }
  const create = useMutation({
    mutationFn: (input: { type: string; value: string; parentId?: ID | null; sortOrder: number }) =>
      api.createDictItem(input),
    onSuccess: () => { invalidate(); toast.success('已新增字典项') },
    onError: onErr,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: ID; input: Partial<{ value: string; parentId: ID | null; sortOrder: number }> }) =>
      api.updateDictItem(id, input),
    onSuccess: () => { invalidate(); toast.success('已保存（引用该值的项目已同步更新）') },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id: ID) => api.deleteDictItem(id),
    onSuccess: () => { invalidate(); toast.success('已删除') },
    onError: onErr, // 删除保护提示由后端/mock 抛出（被引用 409）
  })
  return { create, update, remove }
}

// ---------------- 导入映射方案 ----------------
export function useImportMappings() {
  return useQuery({ queryKey: qk.mappings(), queryFn: () => api.listImportMappings() })
}

export function useMappingMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.mappings() })
  const create = useMutation({
    mutationFn: (input: { name: string; columnMap: Record<string, string>; valueRules: ValueRule[] }) =>
      api.createImportMapping(input),
    onSuccess: () => { invalidate(); toast.success('映射方案已保存') },
    onError: onErr,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: ID; input: { name: string; columnMap: Record<string, string>; valueRules: ValueRule[] } }) =>
      api.updateImportMapping(id, input),
    onSuccess: () => { invalidate(); toast.success('映射方案已更新') },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id: ID) => api.deleteImportMapping(id),
    onSuccess: () => { invalidate(); toast.success('已删除') },
    onError: onErr,
  })
  return { create, update, remove }
}

// ---------------- 导出模板 ----------------
export function useExportTemplates() {
  return useQuery({ queryKey: qk.templates(), queryFn: () => api.listExportTemplates() })
}

export function useTemplateMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.templates() })
  const create = useMutation({
    mutationFn: (input: { name: string; scope: ExportScope; columns: ExportColumn[] }) =>
      api.createExportTemplate(input),
    onSuccess: () => { invalidate(); toast.success('模板已保存') },
    onError: onErr,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: ID; input: { name: string; scope: ExportScope; columns: ExportColumn[] } }) =>
      api.updateExportTemplate(id, input),
    onSuccess: () => { invalidate(); toast.success('模板已更新') },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id: ID) => api.deleteExportTemplate(id),
    onSuccess: () => { invalidate(); toast.success('已删除') },
    onError: onErr,
  })
  return { create, update, remove }
}

// ---------------- 自定义字段 ----------------
export function useCustomFieldDefs() {
  return useQuery({ queryKey: qk.customFields(), queryFn: () => api.listCustomFields() })
}

export function useCustomFieldMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.customFields() })
    qc.invalidateQueries({ queryKey: ['export-fields'] })
    qc.invalidateQueries({ queryKey: ['project-detail'] })
  }
  const create = useMutation({
    mutationFn: (input: {
      fieldKey: string
      label: string
      fieldType: CustomFieldType
      required: boolean
      options: string[]
      sortOrder: number
    }) => api.createCustomField(input),
    onSuccess: () => { invalidate(); toast.success('字段已创建') },
    onError: onErr,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: ID; input: Partial<{ label: string; fieldType: CustomFieldType; required: boolean; options: string[]; sortOrder: number }> }) =>
      api.updateCustomField(id, input),
    onSuccess: () => { invalidate(); toast.success('字段已保存') },
    onError: onErr,
  })
  const remove = useMutation({
    mutationFn: (id: ID) => api.deleteCustomField(id),
    onSuccess: () => { invalidate(); toast.success('字段已删除') },
    onError: onErr, // 被引用不可删由后端抛出
  })
  return { create, update, remove }
}

// ---------------- 导入 / 导出 / 备份 ----------------
export function useImportRecords() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { mappingId?: ID | null; dryRun: boolean; records: ImportRecordInput[] }) =>
      api.importRecords(input),
    onSuccess: (result) => {
      if (!result.dryRun) qc.invalidateQueries() // 正式导入影响面广，全量失效
    },
    onError: onErr,
  })
}

export function useExportFields(scope: ExportScope) {
  return useQuery({ queryKey: qk.exportFields(scope), queryFn: () => api.getExportFields(scope) })
}

export function useExportData() {
  return useMutation({
    mutationFn: (input: {
      templateId?: ID
      scope?: ExportScope
      columns?: ExportColumn[]
      filters?: ExportFilters
    }) => api.exportData(input),
    onError: onErr,
  })
}

export function useBackup() {
  return useMutation({
    mutationFn: () => api.backupAll(),
    onError: onErr,
  })
}
