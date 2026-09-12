import type { Paged, Project } from '@/types'
import type { ApiClient, CustomerAnalysis, ExportResult, ImportResult, ProjectListQuery, RevenueMatrix, RevenueStats } from './types'

// ============================================================
// HTTP 实现：对接真实 Spring Boot 后端（/api，响应 {code, message, data}）
// 本文件负责「线格式 ↔ 前端契约」的适配，页面代码无感。
// ============================================================

const BASE = '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
  }
}

interface ApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
}

export interface AuthUser {
  username: string
  roles: string[]
  authenticationEnabled: boolean
}

interface CsrfInfo {
  headerName: string
  parameterName: string
  token: string
}

let csrfRequest: Promise<CsrfInfo> | null = null
let authenticationEnabled: boolean | null = null

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('presales:unauthorized'))
}

async function bareReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'same-origin',
    ...init,
  })
  if (res.status === 204) return undefined as T
  let body: ApiEnvelope<T> | null = null
  try {
    body = await res.json()
  } catch {
    /* 非 JSON（如下载流） */
  }
  if (!res.ok) {
    if (res.status === 401) notifyUnauthorized()
    throw new ApiError(body?.message || `请求失败：${res.status}`, res.status)
  }
  if (body && typeof body.code === 'number' && body.code !== 0) {
    throw new ApiError(body.message || '请求失败', res.status)
  }
  return (body ? body.data : undefined) as T
}

async function getCsrf(): Promise<CsrfInfo> {
  if (!csrfRequest) csrfRequest = bareReq<CsrfInfo>('/auth/csrf')
  try {
    return await csrfRequest
  } catch (error) {
    csrfRequest = null
    throw error
  }
}

function isUnsafeMethod(method?: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase())
}

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (isUnsafeMethod(init?.method) && authenticationEnabled !== false) {
    const csrf = await getCsrf()
    headers.set(csrf.headerName, csrf.token)
  }
  return bareReq<T>(path, { ...init, headers })
}

export const authApi = {
  currentUser: async () => {
    const user = await req<AuthUser>('/auth/me')
    authenticationEnabled = user.authenticationEnabled
    return user
  },
  login: async (username: string, password: string) => {
    const csrf = await getCsrf()
    const body = new URLSearchParams({ username, password })
    const user = await bareReq<AuthUser>('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        [csrf.headerName]: csrf.token,
      },
      body,
    })
    csrfRequest = null
    authenticationEnabled = true
    return user
  },
  logout: async () => {
    if (authenticationEnabled === false) return
    const csrf = await getCsrf()
    await bareReq<void>('/auth/logout', {
      method: 'POST',
      headers: { [csrf.headerName]: csrf.token },
    })
    csrfRequest = null
    authenticationEnabled = null
  },
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

  // ---------------- 客户分析 ----------------
  listCustomers: async (keyword) => {
    const customers = await req<CustomerAnalysis[]>(`/customers${qs({ keyword })}`)
    return customers.map((customer) => ({
      ...customer,
      revenueTotal: num(customer.revenueTotal),
      projects: customer.projects.map((project) => ({ ...project, revenueTotal: num(project.revenueTotal) })),
    }))
  },

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

  backupAll: () => req('/backup'),
}
