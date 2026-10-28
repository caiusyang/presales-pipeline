import { afterEach, describe, expect, it } from 'vitest'
import { initialProducts, normalizeProductCode, PRODUCT_CATALOG, productName, selectableProducts, setProductCatalog } from './products'
afterEach(() => setProductCatalog(initialProducts()))
describe('动态产品目录', () => {
  it('无需代码常量更新即可识别新增产品及别名', () => { setProductCatalog([...initialProducts(), { id: 100, code: 'NEW', name: '新名称', aliases: ['别名'], applicableTracks: ['HCS'], sortOrder: 150, enabled: true }]); expect(normalizeProductCode('别名')).toBe('NEW'); expect(PRODUCT_CATALOG).toContain('NEW'); expect(productName('NEW')).toBe('新名称'); expect(selectableProducts('公有云').some((p) => p.code === 'NEW')).toBe(false) })
  it('停用不破坏历史拥有记录，初始化目录不受全局缓存污染', () => { const products = initialProducts(); products[0].enabled = false; setProductCatalog(products); expect(selectableProducts('HCS').some((p) => p.code === 'AAD')).toBe(false); expect(selectableProducts('HCS', ['AAD']).some((p) => p.code === 'AAD')).toBe(true); expect(normalizeProductCode('DDoS')).toBe('AAD'); expect(initialProducts()).toHaveLength(14) })
})
