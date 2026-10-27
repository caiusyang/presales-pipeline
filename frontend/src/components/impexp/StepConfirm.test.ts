import { describe, expect, it, vi } from 'vitest'
import type { CustomFieldDef, DictNode } from '@/types'

vi.mock('@/hooks/queries', () => ({}))

import { importPreflightConfiguration } from './StepConfirm'

describe('导入预检配置快照', () => {
  const dictionary: DictNode = { id: 3, type: 'custom_level', value: '普通客户', parentId: null, sortOrder: 10 }
  const definition: CustomFieldDef = {
    id: 4, fieldKey: 'level', label: '客户级别', fieldType: 'option', required: false,
    options: ['普通客户'], dictionaryType: 'custom_level', sortOrder: 10,
  }
  const snapshot = (dictionaries: DictNode[] | undefined, definitions: CustomFieldDef[] | undefined) =>
    JSON.stringify(importPreflightConfiguration(dictionaries, definitions))

  it('候选项新增、改名、字段约束变化都会使已通过的旧预检失效', () => {
    const before = snapshot([dictionary], [definition])
    expect(snapshot([{ ...dictionary, value: '标准客户' }], [definition])).not.toBe(before)
    expect(snapshot([dictionary], [{ ...definition, options: ['普通客户', '重要客户'] }])).not.toBe(before)
    expect(snapshot([dictionary], [{ ...definition, required: true }])).not.toBe(before)
    expect(snapshot([dictionary], [{ ...definition, dictionaryType: 'custom_new_level' }])).not.toBe(before)
  })

  it('相同内容重新取数和仅时间戳变化不会无端重跑预检', () => {
    expect(snapshot([dictionary], [definition])).toBe(snapshot([{ ...dictionary, updatedAt: '2026-10-27T12:00:00' }],
      [{ ...definition, updatedAt: '2026-10-27T12:00:00' }]))
    const another = { ...dictionary, id: 8, value: '重要客户' }
    const anotherDefinition = { ...definition, id: 9, fieldKey: 'region', label: '区域' }
    expect(snapshot([dictionary, another], [definition, anotherDefinition])).toBe(snapshot([another, dictionary], [anotherDefinition, definition]))
  })

  it('配置加载完成与真正空配置分开，树中子项改变也使预检失效', () => {
    expect(snapshot(undefined, undefined)).not.toBe(snapshot([], []))
    const root = { ...dictionary, id: 1, type: 'industry', value: '金融' }
    const child = { ...dictionary, type: 'sub_industry', parentId: 1, value: '银行' }
    expect(snapshot([{ ...root, children: [child] }], [])).not.toBe(snapshot([{ ...root, children: [{ ...child, value: '保险' }] }], []))
  })
})
