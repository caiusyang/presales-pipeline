import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MockDB } from './seed'
import { batchDeleteProjects } from '@/components/project/batchDeleteProjects'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

async function setup() {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  const { mockApi } = await import('./index')
  return mockApi
}

describe('回收站永久删除', () => {
  it('拒绝直接删除活动项目；硬删除后所有关联数据消失且无法恢复', async () => {
    const api = await setup()
    const before = await api.backupAll() as MockDB
    const target = before.projects.find((project) => !project.deleted && project.purchasedProducts.length > 0)!
    expect(target).toBeDefined()
    expect(before.revenues.some((item) => item.projectId === target.id)).toBe(true)
    expect(before.progressLogs.some((item) => item.projectId === target.id)).toBe(true)
    const detail = await api.getProjectDetail(target.id)
    expect(detail.products.length).toBeGreaterThan(0)
    await expect(api.permanentlyDeleteProject(target.id)).rejects.toThrow('请先移入回收站')
    expect(await api.backupAll()).toEqual(before)

    await api.deleteProject(target.id)
    expect((await api.getProjectDetail(target.id)).products).toEqual(detail.products.map((product) => ({ ...product, createdAt: expect.any(String), updatedAt: expect.any(String) })))
    await api.permanentlyDeleteProject(target.id)
    const after = await api.backupAll() as MockDB
    expect(after.projects).toEqual(before.projects.filter((project) => project.id !== target.id))
    expect(after.revenues).toEqual(before.revenues.filter((item) => item.projectId !== target.id))
    expect(after.progressLogs).toEqual(before.progressLogs.filter((item) => item.projectId !== target.id))
    expect(after.changeLogs).toEqual(before.changeLogs.filter((item) => item.projectId !== target.id))
    expect(after.dictionaries).toEqual(before.dictionaries)
    expect(after.customFieldDefs).toEqual(before.customFieldDefs)
    await expect(api.getProjectDetail(target.id)).rejects.toThrow('项目不存在')
    await expect(api.restoreProject(target.id)).rejects.toThrow('未找到')
    await expect(api.permanentlyDeleteProject(target.id)).rejects.toThrow('未找到')
  })

  it('批量硬删除只清理回收站项目，活动项目失败且保持原有状态', async () => {
    const api = await setup()
    const before = await api.listProjects({ size: 200 })
    const [recycled, active] = before.items
    await api.deleteProject(recycled.id)
    const result = await batchDeleteProjects([recycled.id, active.id], (id) => api.permanentlyDeleteProject(id))
    expect(result.deletedIds).toEqual([recycled.id])
    expect(result.failures).toEqual([{ id: active.id, message: '仅允许永久删除回收站中的项目，请先移入回收站' }])
    expect((await api.getProjectDetail(active.id)).project.deleted).toBe(false)
    expect((await api.listProjects({ deleted: true, size: 200 })).items.some((project) => project.id === recycled.id)).toBe(false)
  })
})
