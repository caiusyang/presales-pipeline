/** 初始目录；应用启动后由服务端目录替换，编码始终稳定。 */
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
]
const INITIAL_CODES = [...PRODUCT_CATALOG]

export type ProductCode = string

export interface ProductDefinition {
  id: number
  code: string
  name: string
  aliases: string[]
  applicableTracks: string[]
  sortOrder: number
  enabled: boolean
}
export type ProductInput = Omit<ProductDefinition, 'id'>
export const initialProducts = (): ProductDefinition[] => INITIAL_CODES.map((code, index) => ({ id: index + 1, code, name: code, aliases: code === 'AAD' ? ['DDoS', 'Anti-DDoS'] : code === 'SecMaster' ? ['安全云脑'] : code === 'ESA' ? ['边缘安全ESA'] : code === 'DSC' ? ['数据分类分级'] : [], applicableTracks: [], sortOrder: index * 10, enabled: true }))
let definitions = initialProducts()
export function setProductCatalog(products: ProductDefinition[]) {
  definitions = [...products].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  PRODUCT_CATALOG.splice(0, PRODUCT_CATALOG.length, ...definitions.map((p) => p.code))
}
export const productDefinitions = () => definitions
export const productName = (code: string) => definitions.find((p) => p.code === code)?.name ?? code
export const selectableProducts = (track?: string, selected: string[] = []) => definitions.filter((p) => selected.includes(p.code) || p.enabled && (!p.applicableTracks.length || p.applicableTracks.includes(track ?? '')))

export function normalizeProductCode(value: string): ProductCode | null {
  const normalized = value.trim().toLowerCase()
  return definitions.find((p) => [p.code, p.name, ...p.aliases].some((name) => name.toLowerCase() === normalized))?.code ?? null
}

export function isProductCode(value: string): value is ProductCode {
  return normalizeProductCode(value) != null
}
