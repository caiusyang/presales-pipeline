import { describe, expect, it } from 'vitest'
import { toggleAllExportColumns } from './ExportColumnConfig'

const fields = [
  { key: 'customerName', title: '客户名称' },
  { key: 'projectName', title: '项目名称' },
  { key: 'product.WAF', title: 'WAF' },
]

describe('toggleAllExportColumns', () => {
  it('adds every missing field while preserving selected order and custom titles', () => {
    expect(toggleAllExportColumns(fields, [
      { key: 'projectName', title: '商机名称' },
    ])).toEqual([
      { key: 'projectName', title: '商机名称' },
      { key: 'customerName', title: '客户名称' },
      { key: 'product.WAF', title: 'WAF' },
    ])
  })

  it('clears the selection when every available field is selected', () => {
    expect(toggleAllExportColumns(fields, fields)).toEqual([])
  })
})
