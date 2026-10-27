import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MockDB } from './seed'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

async function setup(legacy = false) {
  const storage = new Map<string, string>()
  if (legacy) {
    const { seedDB } = await import('./seed')
    const data = seedDB()
    const old = { ...data, dictionaryCategories: undefined, customFieldDefs: data.customFieldDefs.map((d) => ({ ...d, dictionaryType: null })) }
    storage.set('presales-pipeline-mock-v6', JSON.stringify(old))
  }
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  const { mockApi } = await import('./index')
  return mockApi
}

describe('自定义字典与项目字段', () => {
  it('保留旧演示数据并补齐分类，不自动重绑已有字段', async () => {
    const api = await setup(true)
    const data = await api.backupAll() as MockDB
    expect(data.projects.length).toBeGreaterThan(0)
    expect(data.dictionaryCategories.map((c) => c.type)).toContain('custom_stage')
    expect((await api.listCustomFields()).find((d) => d.fieldKey === 'stage')?.dictionaryType).toBeNull()
  })

  it('预检不写入，导入去重且失败行不阻挡有效值，绑定字段动态获得值', async () => {
    const api = await setup()
    const category = await api.createDictionaryCategory({ type: 'test_region', label: '客户区域', sortOrder: 100 })
    const def = await api.createCustomField({ fieldKey: 'region', label: '客户区域', fieldType: 'option', dictionaryType: category.type, options: [], required: false, sortOrder: 100 })
    expect(def.options).toEqual([])
    await expect(api.deleteDictionaryCategory(category.id)).rejects.toThrow('关联')
    const records = [{ sourceRow: 2, value: '华东' }, { sourceRow: 3, value: ' 华东 ' }, { sourceRow: 4, value: 'A'.repeat(256) }, { sourceRow: 5, value: '华南' }]
    const input = { type: category.type, parentId: null, records }
    const before = await api.backupAll()
    expect(await api.importDictionaryValues({ ...input, dryRun: true })).toMatchObject({ added: 2, skipped: 1, failed: 1 })
    expect(await api.backupAll()).toEqual(before)
    expect(await api.importDictionaryValues({ ...input, dryRun: false })).toMatchObject({ added: 2, skipped: 1, failed: 1 })
    expect((await api.listCustomFields()).find((d) => d.id === def.id)?.options).toEqual(['华东', '华南'])
    expect(await api.importDictionaryValues({ ...input, dryRun: false })).toMatchObject({ added: 0, skipped: 3, failed: 1 })
    await expect(api.deleteDictionaryCategory(category.id)).rejects.toThrow('全部字典值')
    const [project] = (await api.listProjects({ size: 1 })).items
    const fields = { ...project, projectName: '关联字典测试', externalId: null, customFields: { ...project.customFields, region: '华东' } }
    const created = await api.createProject(fields)
    await expect(api.updateProject(created.id, { ...fields, customFields: { region: '不存在' } })).rejects.toThrow('不在可选项')
    const preview = await api.importRecords({ dryRun: true, records: [{ fields: { ...fields, projectName: '导入字典测试', customFields: { region: '不存在' } }, revenues: [], progress: [] }] })
    expect(preview.skipped).toBe(1)
    const values = await api.getDictionaries(category.type)
    const east = values.find((v) => v.value === '华东')!
    await api.deleteProject(created.id)
    await expect(api.deleteDictItem(east.id)).rejects.toThrow('项目引用')
    await api.updateDictItem(east.id, { ...east, value: '华东大区' })
    const detail = await api.getProjectDetail(created.id)
    expect(detail.project.customFields.region).toBe('华东大区')
    expect(detail.changeLogs).toContainEqual(expect.objectContaining({ field: 'custom.region', oldValue: '华东', newValue: '华东大区' }))
    expect((await api.listCustomFields()).find((d) => d.id === def.id)?.options).toContain('华东大区')
  })

  it('保护固定分类、父子关系、产品目录与必填空字典', async () => {
    const api = await setup()
    const categories = await api.listDictionaryCategories()
    const builtin = categories.find((c) => c.builtIn)!
    await expect(api.deleteDictionaryCategory(builtin.id)).rejects.toThrow('系统字典')
    const category = await api.createDictionaryCategory({ type: 'test_empty', label: '空字典', sortOrder: 100 })
    await expect(api.createCustomField({ fieldKey: 'empty', label: '必填', fieldType: 'option', dictionaryType: category.type, options: [], required: true, sortOrder: 100 })).rejects.toThrow('字典不能为空')
    const solution = (await api.getDictionaries('solution'))[0]
    await expect(api.createDictItem({ type: category.type, value: '错误父级', parentId: solution.id, sortOrder: 10 })).rejects.toThrow('不支持')
    const parentId = solution.children![0].id
    const report = await api.importDictionaryValues({ type: 'product', parentId, dryRun: false, records: [{ sourceRow: 1, value: 'INVALID' }, { sourceRow: 2, value: 'CBH' }] })
    expect(report.failed).toBe(1)
    expect(report.added + report.skipped).toBe(1)
    await api.deleteDictionaryCategory(category.id)
  })

  it('未知分类预检和超限请求不会创建分类、值或字段', async () => {
    const api = await setup()
    const before = await api.backupAll()
    const records = [{ sourceRow: 1, value: '华东' }]
    expect(await api.importDictionaryValues({ type: 'unknown_category', parentId: null, dryRun: true, records })).toMatchObject({ added: 0, failed: 1 })
    await expect(api.importDictionaryValues({ type: 'track', parentId: null, dryRun: false, records: [] })).rejects.toThrow('1至5000')
    await expect(api.importDictionaryValues({ type: 'track', parentId: null, dryRun: false, records: Array.from({ length: 5001 }, () => records[0]) })).rejects.toThrow('1至5000')
    expect(await api.backupAll()).toEqual(before)
  })

  it('旧数字字段转为字典选项后，数字存储的引用仍被保护并随改名同步', async () => {
    const api = await setup()
    const category = await api.createDictionaryCategory({ type: 'custom_numeric', label: '数字选项', sortOrder: 100 })
    const item = await api.createDictItem({ type: category.type, value: '1', parentId: null, sortOrder: 10 })
    const input = { fieldKey: 'numeric_option', label: '数字字段', fieldType: 'number' as const, required: false, options: [], sortOrder: 100 }
    const definition = await api.createCustomField(input)
    const project = (await api.listProjects({ size: 1 })).items[0]
    await api.updateProject(project.id, { ...project, customFields: { ...project.customFields, numeric_option: 1 } })
    await api.updateCustomField(definition.id, { ...input, fieldType: 'option', dictionaryType: category.type })
    await expect(api.deleteDictItem(item.id)).rejects.toThrow('项目引用')
    await api.updateDictItem(item.id, { ...item, value: '一级' })
    expect((await api.getProjectDetail(project.id)).project.customFields.numeric_option).toBe('一级')
  })
})
