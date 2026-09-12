import { describe, expect, it } from 'vitest'
import { emptyProjectInput, projectToInput, validateProjectInput } from './project-utils'
import { solutionCascade } from '@/lib/fields'
import type { DictNode, Project } from '@/types'

describe('项目状态与中标信息', () => {
  it('新建项目默认处于机会点识别', () => {
    expect(emptyProjectInput().projectStatus).toBe('机会点识别')
  })

  it('中标时强制确认方案、细分方案和至少一个产品', () => {
    const input = { ...emptyProjectInput(), customerName: '客户', projectName: '项目', projectStatus: '中标' as const }
    expect(validateProjectInput(input, [])).toBe('中标时请选择解决方案')
    input.solution = '云安全'
    expect(validateProjectInput(input, [])).toBe('中标时请选择细分解决方案')
    input.subSolution = '边界安全'
    expect(validateProjectInput(input, [])).toBe('中标时至少选择一个已购产品')
    input.purchasedProducts = ['WAF']
    expect(validateProjectInput(input, [])).toBeNull()
  })

  it('状态回退时保留中标选择', () => {
    const project = {
      ...emptyProjectInput(),
      id: 1,
      customerName: '客户',
      projectName: '项目',
      projectStatus: '方案设计',
      solution: '云安全',
      subSolution: '边界安全',
      purchasedProducts: ['WAF', 'DDoS'],
      revenueTotal: 0,
      deleted: false,
      createdAt: '2026-01-01T00:00:00',
      updatedAt: '2026-01-01T00:00:00',
    } as Project
    expect(projectToInput(project).purchasedProducts).toEqual(['WAF', 'DDoS'])
  })
})

describe('方案三级关联', () => {
  it('按解决方案和细分方案生成产品选项', () => {
    const tree: DictNode[] = [{
      id: 1, type: 'solution', value: '云安全', parentId: null, sortOrder: 10,
      children: [{
        id: 2, type: 'sub_solution', value: '边界安全', parentId: 1, sortOrder: 10,
        children: [
          { id: 3, type: 'product', value: 'WAF', parentId: 2, sortOrder: 20 },
          { id: 4, type: 'product', value: 'DDoS', parentId: 2, sortOrder: 10 },
        ],
      }],
    }]
    const cascade = solutionCascade(tree)
    expect(cascade.subMap.get('云安全')?.map((item) => item.value)).toEqual(['边界安全'])
    expect(cascade.productMap.get('云安全\u0000边界安全')?.map((item) => item.value)).toEqual(['DDoS', 'WAF'])
  })
})
