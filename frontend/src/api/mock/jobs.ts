import type { BackgroundJob, BackgroundJobItem, ExportResult, ImportRecordResult, JobApi } from '@/api/types'

export interface StoredJob extends BackgroundJob { requestId: string; payload: unknown; retryKey?: string; rows: (BackgroundJobItem & { weight: number })[]; initialized: boolean }
export interface TaskState { jobs: StoredJob[] }
const removed = '项目已永久删除，任务原文及结果快照已清理；旧任务不能恢复该项目'
/** Erase historical copies without retaining customer names or import content as tombstones. */
export function eraseMockProjectTasks(state: TaskState, project: { id: number; externalId?: string | null; customerName: string; projectName: string }, progressIds: number[], aliases: unknown[] = []) {
  const object = (value: unknown): Record<string, any> => value && typeof value === 'object' ? value as Record<string, any> : {}
  const known = [project, ...aliases.map(object)]
  for (const job of state.jobs) for (const row of job.rows) if (object(row.result).projectId === project.id) known.push(object(row.result), object(object(row.input).fields))
  const same = (raw: unknown) => { const v = object(raw), text = (x: unknown) => String(x ?? '').trim().toLowerCase(); return v.projectId === project.id || v.id === project.id || known.some((p) => !!p.externalId && text(v.externalId ?? v.external_id) === text(p.externalId) || !!p.customerName && !!p.projectName && text(v.customerName ?? v.customer_name) === text(p.customerName) && text(v.projectName ?? v.project_name) === text(p.projectName)) }
  const scrub = (raw: unknown) => ({ sourceRow: object(raw).sourceRow, fields: { _purged: true }, revenues: [], progress: [] })
  const exportInput = (raw: unknown) => { const v = object(raw), filters = object(v.filters); if (!Array.isArray(filters.projectIds) || !filters.projectIds.includes(project.id)) return null; const ids = filters.projectIds.filter((id: number) => id !== project.id); return { ...v, filters: { ...filters, projectIds: ids.length ? ids : [-1] } } }
  for (const job of state.jobs) {
    if (['IMPORT', 'PREFLIGHT'].includes(job.kind)) {
      const removedIndices = new Set(job.rows.filter((r) => same(object(r.input).fields) || same(r.result)).map((r) => r.index))
      const payload = object(job.payload); job.payload = { ...payload, records: payload.records?.map((r: unknown, index: number) => removedIndices.has(index) || same(object(r).fields) ? scrub(r) : r) }
      for (const row of job.rows) if (same(object(row.input).fields) || same(row.result)) {
        const previous = object(row.result); row.input = scrub(row.input); row.result = { row: row.index + 1, sourceRow: object(row.input).sourceRow, projectId: previous.projectId ?? null, externalId: null, customerName: '', projectName: '', status: row.status === 'SUCCESS' ? previous.status : 'skipped', reason: removed, issues: [], effectiveFields: {} }
        if (row.status !== 'SUCCESS') { row.status = 'FAILED'; row.error = removed }
      }
    } else if (job.kind === 'EXPORT') {
      job.payload = exportInput(job.payload) ?? job.payload
      for (const row of job.rows) { const input = exportInput(row.input); if (input) { row.input = input; row.result = null; row.status = 'FAILED'; row.error = '导出分块包含已永久删除的项目，结果已清理；重试只导出剩余项目' } }
    } else if (job.kind === 'PROGRESS_REPAIR') {
      const clean = (raw: unknown) => progressIds.includes(object(raw).id) ? { id: object(raw).id, _purged: true } : raw
      job.payload = (job.payload as unknown[]).map(clean)
      for (const row of job.rows) if (progressIds.includes(object(row.input).id)) { row.input = clean(row.input); row.result = { id: object(row.input).id, removed: true }; if (row.status !== 'SUCCESS') { row.status = 'FAILED'; row.error = removed } }
    }
    job.succeeded = job.rows.filter((r) => r.status === 'SUCCESS').reduce((n, r) => n + r.weight, 0); job.failed = job.rows.filter((r) => r.status === 'FAILED').reduce((n, r) => n + r.weight, 0); job.processed = job.rows.filter((r) => r.status !== 'PENDING').reduce((n, r) => n + r.weight, 0)
    if (!['RUNNING', 'QUEUED', 'INTERRUPTED'].includes(job.status) && job.rows.some((r) => r.status === 'FAILED')) job.status = job.succeeded ? 'PARTIAL' : 'FAILED'
    job.updatedAt = new Date().toISOString()
  }
}
const now = () => new Date().toISOString()
const view = ({ rows: _rows, payload: _payload, requestId: _key, initialized: _initialized, retryKey: _retry, ...job }: StoredJob): BackgroundJob => ({ ...job })

export function createMockTasks(options: {
  state: () => TaskState
  save: () => void
  execute: (kind: string, input: unknown, payload: unknown) => Promise<unknown>
  prepareExport: (payload: unknown) => { input: unknown; weight: number }[]
  enter: () => void
  leave: () => void
}): JobApi {
  let running = 0
  const get = (id: string) => { const job = options.state().jobs.find((j) => j.id === id); if (!job) throw new Error('任务不存在'); return job }
  for (const job of options.state().jobs) if (['RUNNING', 'QUEUED'].includes(job.status)) { job.status = 'INTERRUPTED'; job.error = '页面或服务已重启，成功项保留，请重试未成功项' }
  options.save()
  const refresh = (job: StoredJob, finished: boolean) => {
    job.processed = job.rows.filter((r) => r.status !== 'PENDING').reduce((n, r) => n + r.weight, 0)
    job.succeeded = job.rows.filter((r) => r.status === 'SUCCESS').reduce((n, r) => n + r.weight, 0)
    job.failed = job.rows.filter((r) => r.status === 'FAILED').reduce((n, r) => n + r.weight, 0)
    if (finished) job.status = job.rows.some((r) => r.status === 'FAILED') ? job.succeeded ? 'PARTIAL' : 'FAILED' : 'SUCCEEDED'
    job.updatedAt = now(); options.save()
  }
  const identity = (row: ImportRecordResult) => [row.projectId ? `id:${row.projectId}` : '', row.externalId ? `ext:${row.externalId.toLowerCase()}` : '', `name:${row.customerName?.toLowerCase()}\0${row.projectName?.toLowerCase()}`].filter(Boolean)
  const run = async (job: StoredJob) => {
    running++; job.status = 'RUNNING'; options.enter(); options.save()
    try {
      if (!job.initialized) {
        const payload = job.payload as { records?: unknown[] }
        const records = job.kind === 'EXPORT' ? options.prepareExport(payload) : ((job.kind === 'IMPORT' || job.kind === 'PREFLIGHT' ? payload.records : job.payload) as unknown[]).map((input) => ({ input, weight: 1 }))
        job.rows = records.map((r, index) => ({ index, ...r, result: null, status: 'PENDING' }))
        job.total = records.reduce((n, r) => n + r.weight, 0); job.initialized = true; options.save()
      }
      const seen = new Set(job.rows.filter((r) => r.status === 'SUCCESS' && ['IMPORT', 'PREFLIGHT'].includes(job.kind)).flatMap((r) => identity(r.result as ImportRecordResult)))
      let count = 0
      for (const row of job.rows) {
        if (row.status === 'SUCCESS') continue
        try {
          if ((row.input as { _purged?: boolean; fields?: { _purged?: boolean } })?._purged || (row.input as { fields?: { _purged?: boolean } })?.fields?._purged) throw new Error(removed)
          // Preview detects the resolved identity before a formal write; no business data is mutated here.
          if (job.kind === 'IMPORT' || job.kind === 'PREFLIGHT') {
            const preview = await options.execute('PREFLIGHT', row.input, { ...(job.payload as object), dryRun: true }) as ImportRecordResult
            if (preview.status === 'skipped') { row.result = preview; throw new Error(preview.reason || '校验未通过') }
            if (identity(preview).some((key) => seen.has(key))) throw new Error('同批次项目重复，仅处理首次通过的记录')
          }
          row.result = await options.execute(job.kind, row.input, job.payload)
          if (['IMPORT', 'PREFLIGHT'].includes(job.kind)) { const result = row.result as ImportRecordResult; if (result.status === 'skipped') throw new Error(result.reason || '校验未通过'); identity(result).forEach((key) => seen.add(key)) }
          row.status = 'SUCCESS'; row.error = null
        } catch (error) { row.status = 'FAILED'; row.error = (error as Error).message || '执行失败' }
        options.save() // State and business data share the same localStorage snapshot.
        if (++count % 100 === 0) { refresh(job, false); await new Promise((resolve) => setTimeout(resolve, 0)) }
      }
      refresh(job, true)
    } catch (error) { job.status = 'INTERRUPTED'; job.error = (error as Error).message; options.save() }
    finally { running--; options.leave(); schedule() }
  }
  const schedule = () => {
    for (const job of options.state().jobs) { if (running >= 2) break; if (job.status === 'QUEUED') void run(job) }
  }
  const submit = async (requestId: string, kind: string, payload: unknown) => {
    if (!requestId || requestId.length > 128) throw new Error('必须提供1至128字符的唯一请求标识')
    const existing = options.state().jobs.find((j) => j.requestId === requestId)
    if (existing) { if (existing.kind !== kind || JSON.stringify(existing.payload) !== JSON.stringify(payload)) throw new Error('同一请求标识不能用于不同任务'); return view(existing) }
    const job: StoredJob = { id: crypto.randomUUID(), requestId, kind, payload, rows: [], initialized: false, status: 'QUEUED', total: 0, processed: 0, succeeded: 0, failed: 0, createdAt: now(), updatedAt: now() }
    options.state().jobs.unshift(job); options.save(); setTimeout(schedule, 0); return view(job)
  }
  return {
    listJobs: async () => options.state().jobs.slice(0, 30).map(view),
    getJob: async (id) => view(get(id)),
    getJobItems: async (id, page = 0) => ({ total: get(id).rows.length, items: get(id).rows.slice(page * 100, (page + 1) * 100).map((r) => ({ ...r })) }),
    startProjectBatch: ({ requestId, operation, projectIds }) => { if (!['delete', 'restore', 'purge'].includes(operation) || !projectIds.length || projectIds.length > 5000) return Promise.reject(new Error('操作不正确或项目数超限')); return submit(requestId, `PROJECT_${operation.toUpperCase()}`, [...new Set(projectIds)]) },
    startImportJob: ({ requestId, request }) => { if (!request.records.length || request.records.length > 5000) return Promise.reject(new Error('每次需导入1至5000行')); return submit(requestId, request.dryRun ? 'PREFLIGHT' : 'IMPORT', request) },
    startExportJob: ({ requestId, request }) => submit(requestId, 'EXPORT', request),
    startProgressRepairJob: ({ requestId, repairs }) => submit(requestId, 'PROGRESS_REPAIR', repairs),
    startPeopleImport: ({ requestId, people }) => submit(requestId, 'PEOPLE_IMPORT', people),
    retryJob: async (id, requestId) => {
      const job = get(id); if (job.retryKey === requestId || ['RUNNING', 'QUEUED', 'SUCCEEDED'].includes(job.status)) return view(job)
      job.retryKey = requestId; job.status = 'QUEUED'; job.error = null; job.rows.filter((r) => r.status === 'FAILED').forEach((r) => { r.status = 'PENDING'; r.error = null }); refresh(job, false); setTimeout(schedule, 0); return view(job)
    },
    getJobResult: async (id) => {
      const job = get(id)
      if (['QUEUED', 'RUNNING', 'INTERRUPTED'].includes(job.status)) throw new Error('任务尚未完成，请查看进度或重试')
      if (job.kind === 'EXPORT') { if (job.rows.some((r) => r.status !== 'SUCCESS')) throw new Error('导出结果不完整或已清理，请先重试失败分块再下载'); const parts = job.rows.map((r) => r.result as ExportResult); if (!parts.length) throw new Error('没有可下载的导出结果'); const rows = parts.flatMap((p) => p.rows); return { ...parts[0], rows, totalRows: rows.length } }
      if (['IMPORT', 'PREFLIGHT'].includes(job.kind)) {
        const details = job.rows.map((r) => ({ ...(r.status === 'SUCCESS' ? r.result as ImportRecordResult : { ...(r.result as ImportRecordResult | null), status: 'skipped', reason: r.error, sourceRow: (r.input as { sourceRow?: number }).sourceRow, issues: (r.result as ImportRecordResult | null)?.issues ?? [{ field: '_record', code: 'validation', message: r.error || '执行失败' }] }), row: r.index + 1 }))
        return { dryRun: job.kind === 'PREFLIGHT', mappingId: (job.payload as { mappingId?: number }).mappingId ?? null, added: details.filter((r) => r.status === 'added').length, overwritten: details.filter((r) => r.status === 'overwritten').length, skipped: details.filter((r) => r.status === 'skipped').length, details }
      }
      if (job.kind === 'PEOPLE_IMPORT') return { succeeded: job.succeeded, failed: job.failed, details: job.rows }
      const rowId = (input: unknown) => job.kind === 'PROGRESS_REPAIR' ? (input as { id: number }).id : input as number
      return { deletedIds: job.rows.filter((r) => r.status === 'SUCCESS').map((r) => rowId(r.input)), failures: job.rows.filter((r) => r.status !== 'SUCCESS').map((r) => ({ id: rowId(r.input), message: r.error || '执行未完成' })) }
    },
  }
}
