/** 当前产品拥有情况的固定产品目录。顺序同时用于界面展示与导入映射。 */
export const PRODUCT_CATALOG = [
  'AAD',
  'WAF',
  'CFW',
  'ESA',
  'HSS',
  'NDR',
  'DEW',
  'DSC',
  'SecMaster',
  'DBSS',
  'CBH',
  '安全运营专业服务',
  '大模型防火墙',
  '智能体卫士',
] as const

export type ProductCode = (typeof PRODUCT_CATALOG)[number]

const PRODUCT_LOOKUP = new Map(PRODUCT_CATALOG.map((product) => [product.toLowerCase(), product]))

export function normalizeProductCode(value: string): ProductCode | null {
  return PRODUCT_LOOKUP.get(value.trim().toLowerCase()) ?? null
}

export function isProductCode(value: string): value is ProductCode {
  return normalizeProductCode(value) != null
}
