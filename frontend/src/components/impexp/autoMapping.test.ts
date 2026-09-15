import { describe, expect, it } from 'vitest'
import type { CustomFieldDef } from '@/types'
import { autoMapColumns, inferColumnType, pendingFieldsFromTargets } from './autoMapping'
import {
  buildColumnMap,
  buildImportRecords,
  NEW_FIELD_PREFIX,
  PRODUCT_SENTINEL,
  targetsFromColumnMap,
} from './importTransform'

const existingField: CustomFieldDef = {
  id: 1,
  fieldKey: 'existing_note',
  label: '已有备注',
  fieldType: 'text',
  required: false,
  options: [],
  sortOrder: 10,
}

describe('Excel 自动字段映射', () => {
  it('优先匹配基础字段和已有自定义字段，剩余列推断后标记待新增', () => {
    const headers = ['客户名称', '项目名称', '已有备注', '成交金额', '拜访日期', '补充说明']
    const rows = [
      ['甲客户', '甲项目', '重点', '1,234.50', '2026/9/12', '第一次沟通'],
      ['乙客户', '乙项目', '跟进', '88', '2026-09-13', ''],
    ]
    const targets = autoMapColumns(headers, rows, [existingField])

    expect(targets.slice(0, 3).map((target) => target.target)).toEqual([
      'customerName',
      'projectName',
      'custom.existing_note',
    ])
    expect(targets.slice(3).map((target) => target.pendingField?.fieldType)).toEqual([
      'number',
      'date',
      'text',
    ])
    expect(pendingFieldsFromTargets(targets)).toHaveLength(3)
    expect(targets[3].pendingField?.fieldKey).toMatch(/^excel_[a-z0-9_]+$/)
  })

  it('多层表头使用末级名称匹配现有字段', () => {
    const targets = autoMapColumns(
      ['项目基础信息 / 客户名称', '项目基础信息 / 项目名称'],
      [['甲客户', '甲项目']],
      [],
    )
    expect(targets.map((target) => target.target)).toEqual(['customerName', 'projectName'])
  })

  it('新旧预算表头都映射为数值预算字段，旧保存 key 自动升级', () => {
    expect(autoMapColumns(['客户安全预算（万元）'], [['500.25']], [])[0].target).toBe('securityBudget')
    expect(autoMapColumns(['安全空间'], [['88']], [])[0].target).toBe('securityBudget')

    const restored = targetsFromColumnMap(['安全空间'], { 安全空间: 'safetySpace' })
    expect(restored[0].target).toBe('securityBudget')

    const output = buildImportRecords({
      headers: ['客户名称', '项目名称', '客户安全预算（万元）'],
      rows: [['甲客户', '甲项目', '1,234.50']],
      columnMap: { 客户名称: 'customerName', 项目名称: 'projectName', '客户安全预算（万元）': 'securityBudget' },
      valueRules: [],
      today: '2026-09-12',
    })
    expect(output.problems).toEqual([])
    expect(output.records[0].fields.securityBudget).toBe('1234.50')
  })

  it('预算导入在确认前标记负数、非数字和三位小数', () => {
    const output = buildImportRecords({
      headers: ['客户名称', '项目名称', '预算'],
      rows: [
        ['甲客户', '负数', '-1'],
        ['乙客户', '文本', '待确认'],
        ['丙客户', '精度', '1.234'],
      ],
      columnMap: { 客户名称: 'customerName', 项目名称: 'projectName', 预算: 'securityBudget' },
      valueRules: [],
      today: '2026-09-12',
    })
    expect(output.problems).toHaveLength(3)
    expect(output.problems.every((problem) => problem.message.includes('客户安全预算'))).toBe(true)
  })

  it('固定产品列自动映射为已购产品二级选项，非空值表示已购', () => {
    const headers = [
      '基础 / 客户名称',
      '基础 / 项目名称',
      '边界安全 / DDoS',
      '边界安全 / WAF',
      '边界安全 / 边缘安全ESA',
      '安全运营 / SecMaster',
    ]
    const rows = [
      ['甲客户', '甲项目', '已有', '', '√', '是'],
      ['乙客户', '乙项目', '', '1', '', ''],
    ]
    const targets = autoMapColumns(headers, rows, [])

    expect(targets.slice(2).map((target) => [target.target, target.product])).toEqual([
      [PRODUCT_SENTINEL, 'AAD'],
      [PRODUCT_SENTINEL, 'WAF'],
      [PRODUCT_SENTINEL, 'ESA'],
      [PRODUCT_SENTINEL, 'SecMaster'],
    ])

    const columnMap = buildColumnMap(headers, targets)
    const restored = targetsFromColumnMap(headers, columnMap)
    expect(restored[2]).toMatchObject({ target: PRODUCT_SENTINEL, product: 'AAD' })

    const output = buildImportRecords({ headers, rows, columnMap, valueRules: [], today: '2026-09-12' })
    expect(output.records[0].fields.purchasedProducts).toEqual(['AAD', 'ESA', 'SecMaster'])
    expect(output.records[1].fields.purchasedProducts).toEqual(['WAF'])
  })

  it('新增的中英文产品列均能自动识别', () => {
    const headers = ['DBSS', 'CBH', '安全运营专业服务', '大模型防火墙', '智能体卫士']
    const targets = autoMapColumns(headers, [['1', '是', '已有', '√', '开通']], [])

    expect(targets.map((target) => target.product)).toEqual(headers)
    const output = buildImportRecords({
      headers,
      rows: [['1', '是', '已有', '√', '开通']],
      columnMap: buildColumnMap(headers, targets),
      valueRules: [],
      today: '2026-09-12',
    })
    expect(output.records[0].fields.purchasedProducts).toEqual(headers)
  })

  it('全列内容必须一致符合类型才推断为数字或日期', () => {
    expect(inferColumnType(['1', '2,000.50', '-3'])).toBe('number')
    expect(inferColumnType(['2026-09-12', '2026/9/13'])).toBe('date')
    expect(inferColumnType(['1', '待确认'])).toBe('text')
    expect(inferColumnType(['', ''])).toBe('text')
  })

  it('待新增字段可保存映射并在组装记录时规整数值和日期', () => {
    const targets = autoMapColumns(
      ['客户名称', '项目名称', '金额', '日期'],
      [['甲客户', '甲项目', '1,234.50', '2026/9/12']],
      [],
    )
    const columnMap = buildColumnMap(['客户名称', '项目名称', '金额', '日期'], targets)
    expect(columnMap.金额).toMatch(new RegExp(`^${NEW_FIELD_PREFIX}number:`))

    const restored = targetsFromColumnMap(['客户名称', '项目名称', '金额', '日期'], columnMap)
    expect(restored[2].pendingField?.fieldType).toBe('number')
    expect(restored[3].pendingField?.fieldType).toBe('date')

    const output = buildImportRecords({
      headers: ['客户名称', '项目名称', '金额', '日期'],
      rows: [['甲客户', '甲项目', '1,234.50', '2026/9/12']],
      columnMap,
      valueRules: [],
      today: '2026-09-12',
    })
    const customFields = output.records[0].fields.customFields ?? {}
    const pending = pendingFieldsFromTargets(targets)
    expect(customFields[pending[0].fieldKey]).toBe('1234.50')
    expect(customFields[pending[1].fieldKey]).toBe('2026-09-12')
  })
})
