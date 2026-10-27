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
  it('uses a distinct CSRF-protected endpoint for permanent deletion without falling back to soft deletion', async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/auth/csrf') return jsonResponse({ code: 0, data: { headerName: 'X-CSRF-TOKEN', token: 'csrf-permanent' } })
      return jsonResponse({ code: 40900, message: '仅允许永久删除回收站中的项目，请先移入回收站' }, 409)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { httpApi } = await import('./http')
    await expect(httpApi.permanentlyDeleteProject(9)).rejects.toThrow('请先移入回收站')
    const requests = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(requests.map(([path]) => path)).toEqual(['/api/auth/csrf', '/api/projects/9/permanent'])
    expect(requests[1][1].method).toBe('DELETE')
    expect(new Headers(requests[1][1].headers).get('X-CSRF-TOKEN')).toBe('csrf-permanent')
  })
  it('bulk deletion reuses authenticated single-project requests and reports individual failures', async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/auth/csrf') return jsonResponse({ code: 0, data: { headerName: 'X-XSRF-TOKEN', token: 'csrf-bulk' } })
      if (path === '/api/projects/12') return jsonResponse({ code: 50300, message: '删除服务暂不可用' }, 503)
      return jsonResponse({ code: 0, data: null })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { httpApi } = await import('./http')
    const { batchDeleteProjects } = await import('@/components/project/batchDeleteProjects')
    const result = await batchDeleteProjects([7, 12], (id) => httpApi.deleteProject(id))
    expect(result).toEqual({ deletedIds: [7], failures: [{ id: 12, message: '删除服务暂不可用' }] })
    const requests = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(requests.map(([path]) => path)).toEqual(['/api/auth/csrf', '/api/projects/7', '/api/projects/12'])
    requests.slice(1).forEach(([, init]) => {
      expect(init.method).toBe('DELETE')
      expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-bulk')
    })
  })
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

  it('skips login and CSRF when the backend declares local authentication disabled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        code: 0,
        data: { username: '本地用户', roles: ['ROLE_ADMIN'], authenticationEnabled: false },
      }))
      .mockResolvedValueOnce(jsonResponse({ code: 0, data: { id: 1 } }))
    vi.stubGlobal('fetch', fetchMock)
    const { authApi, httpApi } = await import('./http')

    const user = await authApi.currentUser()
    await httpApi.updateDictItem(1, {
      type: 'track', value: '数据安全', parentId: null, sortOrder: 20,
    })

    expect(user.authenticationEnabled).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/dictionaries/1')
    expect(new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers).has('X-CSRF-TOKEN')).toBe(false)
  })
})
