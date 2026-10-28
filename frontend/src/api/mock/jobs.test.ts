import { describe, expect, it, vi, afterEach } from 'vitest'
import { createMockTasks, eraseMockProjectTasks, type TaskState } from './jobs'

afterEach(() => vi.useRealTimers())
describe('持久任务', () => {
  it('硬删除清理原文及不含项目ID列的导出分块，旧导入不可重试重建', async () => {
    vi.useFakeTimers()
    const state: TaskState = { jobs: [] }
    const execute = vi.fn(async (kind, input) => kind === 'EXPORT' ? { scope: 'projects', columns: [{ key: 'projectName', label: '项目名称' }], rows: [{ projectName: '保密项目' }], totalRows: 1 } : { projectId: 1, customerName: '保密客户', projectName: '保密项目', status: 'added', effectiveFields: { secret: '保密原文' } })
    const api = createMockTasks({ state: () => state, save: () => {}, enter: () => {}, leave: () => {}, execute, prepareExport: () => [{ input: { filters: { projectIds: [1, 2] } }, weight: 2 }] })
    const imported = await api.startImportJob({ requestId: 'private', request: { dryRun: false, records: [{ sourceRow: 2, fields: { customerName: '保密客户', projectName: '保密项目' }, progress: [], revenues: [] }] } })
    const exported = await api.startExportJob({ requestId: 'export', request: { scope: 'projects', columns: [{ key: 'projectName', title: '项目名称' }] } })
    await vi.runAllTimersAsync()
    eraseMockProjectTasks(state, { id: 1, customerName: '保密客户', projectName: '保密项目' }, [])
    expect(JSON.stringify(state)).not.toMatch(/保密客户|保密项目|保密原文/)
    expect((await api.getJobItems(imported.id)).items[0].input).toMatchObject({ fields: { _purged: true } })
    await expect(api.getJobResult(exported.id)).rejects.toThrow('已清理')
    expect((state.jobs.find((j) => j.id === exported.id)!.rows[0].input as { filters: { projectIds: number[] } }).filters.projectIds).toEqual([2])
  })
  it('受理幂等、最多2个并行任务、部分失败逐项保留且仅重试失败项', async () => {
    vi.useFakeTimers()
    const state: TaskState = { jobs: [] }, calls: number[] = []
    let active = 0, maximum = 0, fail = true
    const api = createMockTasks({ state: () => state, save: () => {}, prepareExport: () => [], enter: () => { maximum = Math.max(maximum, ++active) }, leave: () => active--,
      execute: async (_kind, input) => { await new Promise((r) => setTimeout(r, 2)); calls.push(input as number); if (input === 2 && fail) throw new Error('暂不可用'); return { id: input } },
    })
    const input = { requestId: 'same', operation: 'delete' as const, projectIds: [1, 2] }
    const job = await api.startProjectBatch(input)
    expect((await api.startProjectBatch(input)).id).toBe(job.id)
    await expect(api.startProjectBatch({ ...input, projectIds: [3] })).rejects.toThrow('不同任务')
    await api.startProjectBatch({ ...input, requestId: 'second', projectIds: [3] }); await api.startProjectBatch({ ...input, requestId: 'third', projectIds: [4] })
    await vi.runAllTimersAsync()
    expect(maximum).toBe(2); expect((await api.getJob(job.id)).status).toBe('PARTIAL')
    expect(await api.getJobResult(job.id)).toEqual({ deletedIds: [1], failures: [{ id: 2, message: '暂不可用' }] })
    fail = false; await api.retryJob(job.id, 'retry'); await vi.runAllTimersAsync()
    expect(calls.filter((n) => n === 1)).toHaveLength(1); expect(calls.filter((n) => n === 2)).toHaveLength(2)
    expect((await api.getJob(job.id)).succeeded).toBe(2)
  })
  it('刷新可查询中断任务及已成功记录，重试不重新执行成功项', async () => {
    vi.useFakeTimers()
    const state: TaskState = { jobs: [{ id: 'existing', kind: 'PROJECT_DELETE', requestId: 'old', payload: [1, 2], initialized: true, status: 'RUNNING', total: 2, succeeded: 1, failed: 0, processed: 1, createdAt: '', updatedAt: '', rows: [{ index: 0, weight: 1, status: 'SUCCESS', input: 1, result: { id: 1 } }, { index: 1, weight: 1, status: 'PENDING', input: 2, result: null }] }] }
    const execute = vi.fn(async (_kind, input) => ({ id: input }))
    const api = createMockTasks({ state: () => state, save: () => {}, execute, prepareExport: () => [], enter: () => {}, leave: () => {} })
    expect((await api.getJob('existing')).status).toBe('INTERRUPTED')
    await api.retryJob('existing', 'resume'); await vi.runAllTimersAsync()
    expect(execute).toHaveBeenCalledExactlyOnceWith('PROJECT_DELETE', 2, [1, 2]); expect((await api.getJob('existing')).status).toBe('SUCCEEDED')
  })
})
