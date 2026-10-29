import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedDB, type MockDB } from './seed'
import { businessDate } from '@/lib/actions'
import { emptyProjectInput, projectToInput } from '@/components/project/project-utils'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
async function setup() {
  const data = seedDB(), today = businessDate()
  const fixture = { ...emptyProjectInput(), createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', revenueTotal: 0, deleted: false }
  data.projects = [
    [true, 6, '高风险', '方案设计', false], [true, 7, '无风险', '方案设计', false],
    [false, 7, '高风险', '方案设计', false], [false, 14, '高风险', '方案设计', false],
    [true, 30, '高风险', '中标', false], [true, 30, '高风险', '方案设计', true],
  ].map(([fixedTarget, days, projectLevel, projectStatus, deleted], i) => ({ ...fixture, id: i+1, externalId: null, customerName: '测试客户', projectName: `跟进项目${i+1}`, fixedTarget, projectLevel, projectStatus, deleted, lastFollowUpAt: new Date(Date.parse(`${today}T04:00:00Z`) - Number(days)*86400000).toISOString() })) as MockDB['projects']
  data.seq = 1000; data.revenues = []; data.progressLogs = []; data.changeLogs = []
  const storage = new Map([['presales-pipeline-mock-v6', JSON.stringify(data)]])
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key,value) })
  const { mockApi } = await import('./index')
  return { api: mockApi, storage }
}

describe('演示模式固定靶提醒', () => {
  it('跨页筛选与后端一致；中标、删除不提醒，风险级别不决定周期', async () => {
    const { api } = await setup()
    const page = await api.listProjects({ followUpRange:'due', size:1, sortBy:'id', sortDirection:'asc' })
    expect(page.total).toBe(2); expect(page.items[0].id).toBe(2)
    expect((await api.listProjects({ followUpRange:'due', page:1, size:1, sortBy:'id', sortDirection:'asc' })).items[0].id).toBe(4)
    expect((await api.listProjects({ followUpRange:'due', fixedTarget:false, projectLevel:'高风险' })).total).toBe(1)
    expect((await api.listProjects({ followUpRange:'due', deleted:true })).total).toBe(0)
    await api.saveFollowUpPolicy({ fixedTargetDays:10, normalDays:20 })
    expect((await api.listProjects({ followUpRange:'due' })).total).toBe(0)
    await expect(api.saveFollowUpPolicy({ fixedTargetDays:7.5, normalDays:14 })).rejects.toThrow('整数')
  })
  it('无变化保存与导出不刷新时间；真实字段修改记录日志，导入预检不写入', async () => {
    const { api } = await setup()
    const original = (await api.getProjectDetail(2)).project
    const saved = await api.updateProject(2, projectToInput(original))
    expect(saved.lastFollowUpAt).toBe(original.lastFollowUpAt)
    const input = { dryRun:true, records:[{ fields:{ customerName:'新客户',projectName:'导入项目',fixedTarget:'是' as never,projectLevel:'高风险' as const },revenues:[],progress:[] }] }
    const before = await api.backupAll()
    expect((await api.importRecords(input)).added).toBe(1)
    expect(await api.backupAll()).toEqual(before)
    const exported = await api.exportData({ scope:'combined',columns:[{ key:'fixedTarget',title:'是否固定靶' },{ key:'projectLevel',title:'项目级别' }],filters:{ projectIds:[2] } })
    expect(exported.rows).toEqual([{ fixedTarget:'是',projectLevel:'无风险' }])
    expect((await api.getProjectDetail(2)).project.lastFollowUpAt).toBe(original.lastFollowUpAt)
    const changed = await api.updateProject(2, { ...projectToInput(original), fixedTarget:false,projectLevel:'高风险' })
    expect(changed.lastFollowUpAt).not.toBe(original.lastFollowUpAt)
    const logs = (await api.getProjectDetail(2)).changeLogs.map((log) => log.field)
    expect(logs).toEqual(expect.arrayContaining(['fixedTarget','projectLevel']))
  })
})
