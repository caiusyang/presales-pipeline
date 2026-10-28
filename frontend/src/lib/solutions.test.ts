import { describe, expect, it } from 'vitest'
import { normalizeSolutions, solutionSelections, withSolutions } from './solutions'
describe('结构化方案关联', () => {
  it('兼容单方案并保持父子对应，不用逗号拆方案', () => expect(solutionSelections({ solution: '甲', subSolution: '甲一' })).toEqual([{ solution: '甲', subSolutions: ['甲一'] }]))
  it('按父方案去重，保留多个细分方案和不同父级的同名子方案', () => expect(normalizeSolutions([{ solution: '甲', subSolutions: ['同名', '甲二'] }, { solution: '乙', subSolutions: ['同名'] }, { solution: '甲', subSolutions: ['同名'] }])).toEqual(expect.arrayContaining([{ solution: '甲', subSolutions: ['同名', '甲二'].sort() }, { solution: '乙', subSolutions: ['同名'] }])))
  it('切换方案保留已购产品', () => expect(withSolutions({ purchasedProducts: ['WAF'], solution: '甲' }, [{ solution: '乙', subSolutions: [] }]).purchasedProducts).toEqual(['WAF']))
})
