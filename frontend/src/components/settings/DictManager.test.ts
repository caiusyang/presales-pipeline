import { describe, expect, it } from 'vitest'
import { DICT_KINDS, dictionaryKinds, dictionaryValueTarget } from './dictKinds'

describe('dictionary management categories', () => {
  it('preserves the fixed dictionaries and their hierarchy controls', () => {
    expect(DICT_KINDS.map((kind) => kind.value)).toEqual(['track', 'industry', 'solution'])
    expect(DICT_KINDS.every((kind) => kind.builtIn)).toBe(true)
  })

  it('includes empty custom categories, preserves fixed labels and sorts custom categories', () => {
    const kinds = dictionaryKinds([
      { id: 5, type: 'custom_region', label: '区域', builtIn: false, sortOrder: 20 },
      { id: 3, type: 'industry', label: '不可替换的固定名称', builtIn: true, sortOrder: 1 },
      { id: 4, type: 'custom_priority', label: '优先级', builtIn: false, sortOrder: 10 },
    ])
    expect(kinds.map((kind) => kind.label)).toEqual(['赛道', '行业', '方案与产品', '优先级', '区域'])
    expect(kinds[1]).toMatchObject({ value: 'industry', builtIn: true, id: 3 })
    expect(kinds.at(-1)).toMatchObject({ value: 'custom_region', builtIn: false, id: 5 })
  })

  it('routes selected hierarchy levels to their exact value type for add and import', () => {
    const parent = { id: 8, type: 'industry', value: '金融', parentId: null, sortOrder: 0 }
    expect(dictionaryValueTarget('industry', parent)).toEqual({ type: 'sub_industry', parentId: 8 })
    expect(dictionaryValueTarget('solution', { ...parent, type: 'solution' })).toEqual({ type: 'sub_solution', parentId: 8 })
    expect(dictionaryValueTarget('solution', { ...parent, type: 'sub_solution' })).toEqual({ type: 'product', parentId: 8 })
    expect(dictionaryValueTarget('solution', null)).toEqual({ type: 'solution', parentId: null })
    expect(dictionaryValueTarget('custom_region', parent)).toEqual({ type: 'custom_region', parentId: null })
  })
})
