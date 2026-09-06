import type { Paged, Project } from '@/types'
import type { ApiClient, ExportResult, ImportResult, ProjectListQuery, RevenueMatrix, RevenueStats } from './types'

// ============================================================
// HTTP 实现：对接真实 Spring Boot 后端（/api，响应 {code, message, data}）
// 本文件负责「线格式 ↔ 前端契约」的适配，页面代码无感。
// ============================================================

const BASE = '/api'

class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (res.status === 204) return undefined as T
  let body: { code?: number; message?: string; data?: T } | null = null
  try {
    body = await res.json()
  } catch {
    /* 非 JSON（如下载流） */
  }
  if (!res.ok) throw new ApiError(body?.message || `请求失败：${res.status}`, res.status)
  if (body && typeof body.code === 'number' && body.code !== 0) {
    throw new ApiError(body.message || '请求失败', res.status)
  }
  return (body ? body.data : undefined) as T
}

const qs = (params: Record<string, unknown>) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** 后端 PageData（兼容标准 Spring Page）→ 前端 Paged */
interface PageWire<T> {
  items?: T[]
  content?: T[]
  totalElements?: number
}
const toPaged = <T>(p: PageWire<T> | T[]): Paged<T> => {
  if (Array.isArray(p)) return { items: p, total: p.length }
  const items = p.items ?? p.content ?? []
  return { items, total: p.totalElements ?? items.length }
}

/** BigDecimal 等数值线格式兜底转 number */
const num = (v: unknown): number => (v == null ? 0 : Number(v))

function normalizeMatrix(raw: RevenueMatrix): RevenueMatrix {
  return {
    months: raw.months ?? [],
    rows: (raw.rows ?? []).map((r) => ({
      ...r,
      amounts: Object.fromEntries(Object.entries(r.amounts ?? {}).map(([k, v]) => [k, num(v)])),
      total: num(r.total),
    })),
  }
}

export const httpApi: ApiClient = {
  // ---------------- 项目 ----------------
  listProjects: async (q: ProjectListQuery) => {
    const data = await req<PageWire<Project>>(`/projects${qs({ ...q, size: q.size ?? 50 })}`)
    return toPaged(data)
  },
  getProjectDetail: (id) => req(`/projects/${id}/detail`),
  createProject: (input) => req('/projects', { method: 'POST', body: JSON.stringify(input) }),
  updateProject: (id, input) => req(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteProject: (id) => req(`/projects/${id}`, { method: 'DELETE' }),
  restoreProject: (id) => req(`/projects/${id}/restore`, { method: 'POST' }),

  // ---------------- 进展 ----------------
  addProgress: (input) => req('/progress', { method: 'POST', body: JSON.stringify(input) }),
  deleteProgress: (id) => req(`/progress/${id}`, { method: 'DELETE' }),

  // ---------------- 收入 ----------------
  getRevenueMatrix: async (params) => normalizeMatrix(await req<RevenueMatrix>(`/revenues${qs({ ...params })}`)),
  saveRevenues: (entries) => req('/revenues', { method: 'PUT', body: JSON.stringify({ entries }) }),

  // ---------------- 统计 ----------------
  getRevenueStats: async ({ dim, year }) => {
    const data = await req<RevenueStats>(`/stats/revenue${qs({ dim, year })}`)
    return { ...data, total: num(data.total), items: (data.items ?? []).map((i) => ({ ...i, amount: num(i.amount) })) }
  },

  // ---------------- 字典 ----------------
  getDictionaries: (type) => req(`/dictionaries${qs({ type })}`),
  createDictItem: (input) => req('/dictionaries', { method: 'POST', body: JSON.stringify(input) }),
  updateDictItem: (id, input) => req(`/dictionaries/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteDictItem: (id) => req(`/dictionaries/${id}`, { method: 'DELETE' }),

  // ---------------- 配置 ----------------
  listImportMappings: () => req('/config/import-mappings'),
  createImportMapping: (input) => req('/config/import-mappings', { method: 'POST', body: JSON.stringify(input) }),
  updateImportMapping: (id, input) =>
    req(`/config/import-mappings/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteImportMapping: (id) => req(`/config/import-mappings/${id}`, { method: 'DELETE' }),

  listExportTemplates: () => req('/config/export-templates'),
  createExportTemplate: (input) => req('/config/export-templates', { method: 'POST', body: JSON.stringify(input) }),
  updateExportTemplate: (id, input) =>
    req(`/config/export-templates/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteExportTemplate: (id) => req(`/config/export-templates/${id}`, { method: 'DELETE' }),

  listCustomFields: () => req('/config/custom-fields'),
  createCustomField: (input) => req('/config/custom-fields', { method: 'POST', body: JSON.stringify(input) }),
  updateCustomField: (id, input) => req(`/config/custom-fields/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCustomField: (id) => req(`/config/custom-fields/${id}`, { method: 'DELETE' }),

  // ---------------- 导入 / 导出 / 备份 ----------------
  importRecords: async (input) => {
    const data = await req<ImportResult>('/import', { method: 'POST', body: JSON.stringify(input) })
    return data
  },

  getExportFields: (scope) => req(`/export/fields${qs({ scope })}`),
  exportData: (input) => req<ExportResult>('/export', { method: 'POST', body: JSON.stringify(input) }),

  backupAll: async () => {
    const res = await fetch(BASE + '/backup')
    if (!res.ok) throw new ApiError(`备份失败：${res.status}`, res.status)
    return res.json()
  },
}
