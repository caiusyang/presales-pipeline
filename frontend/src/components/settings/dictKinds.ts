import type { DictNode, ID } from '@/types'

export type DictKind = string

export interface DictionaryCategoryMeta {
  id: ID
  type: string
  label: string
  builtIn: boolean
  sortOrder: number
}

export interface DictionaryKind {
  value: DictKind
  label: string
  hint: string
  builtIn: boolean
  id?: ID
}

export const DICT_KINDS: DictionaryKind[] = [
  { value: 'track', label: '赛道', hint: '项目「赛道」字段的可选值', builtIn: true },
  { value: 'industry', label: '行业', hint: '行业为两级结构：顶级行业下可挂子行业', builtIn: true },
  { value: 'solution', label: '方案与产品', hint: '三级结构：解决方案 → 细分解决方案 → 固定产品目录', builtIn: true },
]

/** 固定分类始终保留，自定义分类（包括空分类）来自服务端元数据。 */
export function dictionaryKinds(categories: DictionaryCategoryMeta[] = []): DictionaryKind[] {
  const fixedTypes = new Set(DICT_KINDS.map((kind) => kind.value))
  return [
    ...DICT_KINDS.map((kind) => ({ ...kind, id: categories.find((category) => category.type === kind.value)?.id })),
    ...categories.filter((category) => !fixedTypes.has(category.type))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((category) => ({
        value: category.type,
        label: category.label,
        hint: '自定义字典，可在「自定义字段」中作为选项来源',
        builtIn: category.builtIn,
        id: category.id,
      })),
  ]
}

/** 添加与批量导入使用同一个目标，避免层级选择改变时导入到错误分类。 */
export function dictionaryValueTarget(kind: DictKind, parent: DictNode | null) {
  if ((kind === 'industry' || kind === 'solution') && parent) {
    return {
      type: kind === 'industry' ? 'sub_industry' : parent.type === 'solution' ? 'sub_solution' : 'product',
      parentId: parent.id,
    }
  }
  return { type: kind, parentId: null }
}
