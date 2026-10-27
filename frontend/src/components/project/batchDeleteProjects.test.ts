import { afterEach, describe, expect, it, vi } from 'vitest'
import { batchDeleteProjects } from './batchDeleteProjects'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('项目批量删除', () => {
  it('只提交明确勾选的项目，重复 ID 不会重复删除，空选择不会请求', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    expect(await batchDeleteProjects([7, 12, 7], remove)).toEqual({ deletedIds: [7, 12], failures: [] })
    expect(remove.mock.calls).toEqual([[7], [12]])
    remove.mockClear()
    expect(await batchDeleteProjects([], remove)).toEqual({ deletedIds: [], failures: [] })
    expect(remove).not.toHaveBeenCalled()
  })

  it('单项失败不掩盖其他项目结果，失败项目可保留选择并重试', async () => {
    const remove = vi.fn(async (id: number) => {
      if (id === 2) throw new Error('连接已断开')
      if (id === 4) throw null
    })
    const result = await batchDeleteProjects([1, 2, 3, 4, 5], remove)
    expect(result.deletedIds).toEqual([1, 3, 5])
    expect(result.failures).toEqual([
      { id: 2, message: '连接已断开' },
      { id: 4, message: '删除结果未确认，请刷新列表或回收站核对' },
    ])
    expect(remove).toHaveBeenCalledTimes(5)
    const retry = vi.fn().mockResolvedValue(undefined)
    expect((await batchDeleteProjects(result.failures.map((failure) => failure.id), retry)).deletedIds).toEqual([2, 4])
    expect(retry.mock.calls).toEqual([[2], [4]])
  })

  it('跨多页选择时限制同时执行的删除请求，仍完成全部选择', async () => {
    let active = 0, maximum = 0
    const remove = vi.fn(async () => {
      active++; maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 0))
      active--
    })
    const ids = Array.from({ length: 45 }, (_, index) => index + 1)
    const result = await batchDeleteProjects(ids, remove)
    expect(maximum).toBeLessThanOrEqual(4)
    expect(result.deletedIds).toEqual(ids)
    expect(result.failures).toEqual([])
  })

  it('演示模式将选中项目放入回收站，保留收入及进展，并可恢复', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    const { mockApi } = await import('@/api/mock')
    const before = await mockApi.listProjects({ size: 200 })
    const targets = before.items.slice(0, 2)
    const ids = targets.map((project) => project.id)
    const details = await Promise.all(ids.map((id) => mockApi.getProjectDetail(id)))
    const result = await batchDeleteProjects(ids, (id) => mockApi.deleteProject(id))
    expect(result.deletedIds).toEqual(ids)
    const active = await mockApi.listProjects({ size: 200 })
    expect(active.total).toBe(before.total - 2)
    expect(active.items.every((project) => !ids.includes(project.id))).toBe(true)
    const recycled = await mockApi.listProjects({ deleted: true, size: 200 })
    expect(recycled.items.filter((project) => ids.includes(project.id))).toHaveLength(2)
    for (const [index, id] of ids.entries()) {
      await mockApi.restoreProject(id)
      const restored = await mockApi.getProjectDetail(id)
      expect(restored.project.deleted).toBe(false)
      expect(restored.revenues).toEqual(details[index].revenues)
      expect(restored.progress).toEqual(details[index].progress)
    }
    expect((await mockApi.listProjects({ size: 200 })).total).toBe(before.total)
  })
})
