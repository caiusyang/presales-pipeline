import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { parseExcelFile } from './excel'
import { autoMapColumns } from './autoMapping'
import { buildColumnMap, buildImportRecords, PRODUCT_SENTINEL } from './importTransform'

describe('交付模板端到端解析和语义映射', () => {
  for (const name of ['公有云导入模板', 'HCS本地项目模板']) it(`${name}预算零值、方案父子JSON、日期和需求含义不丢失`, async () => {
    const buffer=await readFile(new URL(`../../../../docs/deliverables/${name}.xlsx`,import.meta.url))
    const parsed=await parseExcelFile(new File([buffer],`${name}.xlsx`))
    const targets=autoMapColumns(parsed.headers,parsed.rows,[]), columnMap=buildColumnMap(parsed.headers,targets)
    expect(columnMap['本地售前状态']).toBe('projectStatus');expect(columnMap['方案集合（JSON）']).toBe('solutions')
    expect(targets[parsed.headers.indexOf('已购产品/WAF')]).toMatchObject({target:PRODUCT_SENTINEL,product:'WAF'})
    if(name==='公有云导入模板')expect(targets[parsed.headers.indexOf('需求洞察/WAF')].pendingField).toBeTruthy()
    const output=buildImportRecords({headers:parsed.headers,rows:parsed.rows,columnMap,valueRules:[],today:'2026-10-28'})
    expect(output.problems).toEqual([]);expect(Number(output.records[0].fields.securityBudget)).toBe(0)
    expect(output.records[0].fields.solutions).toEqual([]);expect(output.records[0].fields.purchasedProducts).toEqual([])
    expect(output.records[0].progress).toEqual([{logDate:'2025-09-13',content:'示例进展，请替换\n后续无日期行并入同一条进展'}])
  })
})
