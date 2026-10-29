import { describe, expect, it } from 'vitest'
import { autoMapColumns } from './autoMapping'
import { buildColumnMap, buildImportRecords } from './importTransform'
import { applyEdits, localImportIssues, mappingRule, mergeImportFields, optionsForField, validateImportRecord, valueText } from './importReview'

describe('固定靶及项目级别导入', () => {
  const headers = ['客户名称', '项目名称', '是否固定靶', '项目级别']
  function transform(rows: string[][]) {
    return buildImportRecords({ headers, rows, columnMap: buildColumnMap(headers, autoMapColumns(headers, rows, [])), valueRules: [], today: '2026-10-29' })
  }
  it('现有字段自动识别，不创建自定义字段，布尔和级别按标准值保存', () => {
    const output = transform([['甲', 'A', '是', '无风险'], ['乙', 'B', '0', '高风险'], ['丙', 'C', 'false', '低风险']])
    expect(output.problems).toEqual([])
    expect(output.records.map((r) => r.fields.fixedTarget)).toEqual([true, false, false])
    expect(output.records.map((r) => r.fields.projectLevel)).toEqual(['无风险', '高风险', '低风险'])
    expect(optionsForField('fixedTarget', {}, [], [])).toEqual(['是', '否'])
    expect(valueText(true)).toBe('是'); expect(valueText(false)).toBe('否')
  })
  it('未知值保留待修正；行内修改和标准值映射都能消除问题', () => {
    const output = transform([['甲', 'A', '重点', '重点项目']])
    const record = output.records[0]
    expect(localImportIssues(record, output.problems)).toHaveLength(2)
    const fixed = applyEdits(record, { fixedTarget: '否', projectLevel: '低风险' })
    expect(localImportIssues(fixed, output.problems)).toEqual([])
    expect(validateImportRecord(fixed, [], [])).toEqual([])
    expect(fixed.fields.fixedTarget).toBe(false)
    const mapped = buildImportRecords({ headers, rows: [['甲', 'A', '重点', '重点项目']], columnMap: buildColumnMap(headers, autoMapColumns(headers, [], [])), valueRules: [mappingRule('fixedTarget', '重点', '是', {}), mappingRule('projectLevel', '重点项目', '高风险', {})], today: '2026-10-29' })
    expect(mapped.problems).toEqual([]); expect(mapped.records[0].fields.fixedTarget).toBe(true)
  })
  it('未提供的列沿用已有值；新项目默认为非固定靶且未评级', () => {
    expect(mergeImportFields({}, { fixedTarget: true, projectLevel: '高风险' })).toMatchObject({ fixedTarget: true, projectLevel: '高风险' })
    expect(mergeImportFields({ fixedTarget: false, projectLevel: '' }, { fixedTarget: true, projectLevel: '高风险' })).toMatchObject({ fixedTarget: false, projectLevel: null })
    expect(mergeImportFields({})).toMatchObject({ fixedTarget: false, projectLevel: null })
  })
})
