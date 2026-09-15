import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadColumnStates } from './columns'

afterEach(() => vi.unstubAllGlobals())

describe('项目列配置兼容', () => {
  it('保留旧安全空间列的顺序与显隐设置并升级字段 key', () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(JSON.stringify([
        { key: 'projectName', visible: true },
        { key: 'safetySpace', visible: true },
      ])),
    }
    vi.stubGlobal('localStorage', storage)

    expect(loadColumnStates([
      { key: 'projectName', label: '项目名称', defaultVisible: true },
      { key: 'securityBudget', label: '客户安全预算（万元）', defaultVisible: false },
    ])).toEqual([
      { key: 'projectName', visible: true },
      { key: 'securityBudget', visible: true },
    ])
  })
})
