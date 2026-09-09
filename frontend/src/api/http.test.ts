import { afterEach, describe, expect, it, vi } from 'vitest'

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('HTTP API contract', () => {
  it('maps backend PageData.items without losing projects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      code: 0,
      message: '成功',
      data: { items: [{ id: 7, customerName: '客户', projectName: '项目' }], totalElements: 1 },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { httpApi } = await import('./http')

    const result = await httpApi.listProjects({ page: 0, size: 20 })

    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe(7)
  })

  it('sends complete dictionary and custom-field update payloads with CSRF protection', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        code: 0,
        data: { headerName: 'X-XSRF-TOKEN', parameterName: '_csrf', token: 'csrf-token' },
      }))
      .mockResolvedValueOnce(jsonResponse({ code: 0, data: { id: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ code: 0, data: { id: 2 } }))
    vi.stubGlobal('fetch', fetchMock)
    const { httpApi } = await import('./http')

    await httpApi.updateDictItem(1, {
      type: 'track', value: '数据安全', parentId: null, sortOrder: 20,
    })
    await httpApi.updateCustomField(2, {
      fieldKey: 'stage', label: '项目阶段', fieldType: 'option', required: false,
      options: ['初访', '方案'], sortOrder: 10,
    })

    const dictionaryInit = fetchMock.mock.calls[1][1] as RequestInit
    const customFieldInit = fetchMock.mock.calls[2][1] as RequestInit
    expect(JSON.parse(String(dictionaryInit.body))).toEqual({
      type: 'track', value: '数据安全', parentId: null, sortOrder: 20,
    })
    expect(JSON.parse(String(customFieldInit.body))).toMatchObject({ fieldKey: 'stage', label: '项目阶段' })
    expect(new Headers(dictionaryInit.headers).get('X-XSRF-TOKEN')).toBe('csrf-token')
  })
})
