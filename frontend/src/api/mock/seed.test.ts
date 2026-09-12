import { describe, expect, it } from 'vitest'
import { PROJECT_STATUSES } from '@/types'
import { PRODUCT_CATALOG } from '@/lib/products'
import { seedDB } from './seed'

describe('demo seed data', () => {
  it('covers the latest project stages and winning requirements', () => {
    const db = seedDB()
    const statuses = new Set(db.projects.map((project) => project.projectStatus))
    expect(statuses).toEqual(new Set(PROJECT_STATUSES))

    const wonProjects = db.projects.filter((project) => project.projectStatus === '中标')
    expect(wonProjects.length).toBeGreaterThan(0)
    expect(wonProjects.every((project) =>
      Boolean(project.solution)
      && Boolean(project.subSolution)
      && project.purchasedProducts.length > 0)).toBe(true)
  })

  it('contains the complete fixed product catalog and customer-level samples', () => {
    const db = seedDB()
    const configuredProducts = new Set(
      db.dictionaries.filter((item) => item.type === 'product').map((item) => item.value),
    )
    expect(PRODUCT_CATALOG.every((product) => configuredProducts.has(product))).toBe(true)

    const projectCounts = new Map<string, number>()
    db.projects.forEach((project) => {
      projectCounts.set(project.customerName, (projectCounts.get(project.customerName) ?? 0) + 1)
    })
    expect([...projectCounts.values()].some((count) => count > 1)).toBe(true)
  })
})
