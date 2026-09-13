export type DictKind = 'track' | 'industry' | 'solution'

export const DICT_KINDS: { value: DictKind; label: string; hint: string }[] = [
  { value: 'track', label: '赛道', hint: '项目「赛道」字段的可选值' },
  { value: 'industry', label: '行业', hint: '行业为两级结构：顶级行业下可挂子行业' },
  { value: 'solution', label: '方案与产品', hint: '三级结构：解决方案 → 细分解决方案 → 固定产品目录' },
]
