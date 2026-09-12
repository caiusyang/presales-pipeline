import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildExportWorkbook, MAX_IMPORT_FILE_BYTES, parseExcelFile, validateImportFile } from './excel'

function multiLevelHeaderFile(includeData: boolean): File {
  const worksheet = {} as XLSX.WorkSheet
  XLSX.utils.sheet_add_aoa(worksheet, [
    ['区域', '客户名称', '云安全解决方案需求洞察', '', ''],
    ['', '', '上云安全', '', '数据安全'],
    ['', '', '边界安全', '', ''],
    ['', '', 'WAF', 'DDoS', ''],
    ...(includeData ? [['华北', '示例客户', '需要', '待确认', '重点需求']] : []),
  ], { origin: 'A2' })
  // SheetJS 从空对象追加时会保守地把 !ref 起点设为 A1；用户文件实际从 A2 开始。
  worksheet['!ref'] = includeData ? 'A2:E6' : 'A2:E5'
  worksheet['!merges'] = [
    XLSX.utils.decode_range('A2:A5'),
    XLSX.utils.decode_range('B2:B5'),
    XLSX.utils.decode_range('C2:E2'),
    XLSX.utils.decode_range('C3:D3'),
    XLSX.utils.decode_range('C4:D4'),
    XLSX.utils.decode_range('E3:E5'),
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '多级表头')
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new File([bytes], '多级表头.xlsx')
}

describe('validateImportFile', () => {
  it('accepts supported files within the size limit', () => {
    expect(() => validateImportFile({ name: '项目.xlsx', size: 1024 })).not.toThrow()
    expect(() => validateImportFile({ name: '项目.CSV', size: 1024 })).not.toThrow()
  })

  it('rejects unsupported, empty, and oversized files', () => {
    expect(() => validateImportFile({ name: '项目.txt', size: 10 })).toThrow('仅支持')
    expect(() => validateImportFile({ name: '项目.xlsx', size: 0 })).toThrow('文件为空')
    expect(() => validateImportFile({ name: '项目.xlsx', size: MAX_IMPORT_FILE_BYTES + 1 })).toThrow('不能超过')
  })

  it('restores merged multi-level headers and excludes header rows from data', async () => {
    const parsed = await parseExcelFile(multiLevelHeaderFile(true))

    expect(parsed.headerRows).toBe(4)
    expect(parsed.dataStartRow).toBe(6)
    expect(parsed.headers).toEqual([
      '区域',
      '客户名称',
      '云安全解决方案需求洞察 / 上云安全 / 边界安全 / WAF',
      '云安全解决方案需求洞察 / 上云安全 / 边界安全 / DDoS',
      '云安全解决方案需求洞察 / 数据安全',
    ])
    expect(parsed.rows).toEqual([['华北', '示例客户', '需要', '待确认', '重点需求']])
    expect(parsed.totalRows).toBe(1)
  })

  it('returns zero records for a header-only workbook instead of treating child headers as data', async () => {
    const parsed = await parseExcelFile(multiLevelHeaderFile(false))

    expect(parsed.headerRows).toBe(4)
    expect(parsed.rows).toEqual([])
    expect(parsed.totalRows).toBe(0)
  })

  it('keeps ordinary single-row CSV headers unchanged', async () => {
    const parsed = await parseExcelFile(new File(['客户名称,项目名称\n示例客户,示例项目'], '项目.csv'))

    expect(parsed.headerRows).toBe(1)
    expect(parsed.dataStartRow).toBe(2)
    expect(parsed.headers).toEqual(['客户名称', '项目名称'])
    expect(parsed.rows).toEqual([['示例客户', '示例项目']])
  })
})

describe('buildExportWorkbook', () => {
  it('keeps the combined export in one worksheet with numeric revenue and multiline progress', () => {
    const workbook = buildExportWorkbook(
      [
        { key: 'projectName', title: '项目名称' },
        { key: 'revenue.2026-08', title: '2026-08收入（万元）' },
        { key: 'progressSummary', title: '进展日志（日期：内容）' },
      ],
      [{
        projectName: '数据安全治理',
        'revenue.2026-08': 120.5,
        progressSummary: '2026-08-18：完成访谈\n2026-08-10：提交方案',
      }],
      '项目综合表',
    )

    expect(workbook.SheetNames).toEqual(['项目综合表'])
    const sheet = workbook.Sheets['项目综合表']
    expect(sheet.A2.v).toBe('数据安全治理')
    expect(sheet.B2.v).toBe(120.5)
    expect(sheet.B2.t).toBe('n')
    expect(sheet.B2.z).toBe('#,##0.00')
    expect(sheet.C2.v).toContain('\n')
    expect(sheet['!autofilter']?.ref).toBe('A1:C2')

    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true })
    const reopened = XLSX.read(bytes, { type: 'array', cellStyles: true })
    expect(reopened.SheetNames).toEqual(['项目综合表'])
    expect(reopened.Sheets['项目综合表'].B2.v).toBe(120.5)
    expect(reopened.Sheets['项目综合表'].C2.v).toContain('2026-08-10：提交方案')
  })
})
