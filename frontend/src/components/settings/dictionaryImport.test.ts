import { describe, expect, it } from 'vitest'
import { parseExcelFile, type ParsedSheet } from '@/components/impexp/excel'
import {
  defaultDictionaryValueColumn,
  dictionaryRecordsFromPaste,
  dictionaryRecordsFromSheet,
  MAX_DICTIONARY_IMPORT_ROWS,
} from './dictionaryImport'

const sheet: ParsedSheet = {
  sheetName: '区域',
  headers: ['序号', '字典值'],
  headerRows: 3,
  dataStartRow: 6,
  rows: [['1', ' 华东 '], ['2', ''], ['3', '华南'], ['4']],
  totalRows: 4,
}

describe('dictionary import source selection', () => {
  it('prefers a value column over an unrelated first column', () => {
    expect(defaultDictionaryValueColumn(['序号', '字典值'])).toBe(1)
    expect(defaultDictionaryValueColumn(['备注', ' Value '])).toBe(1)
    expect(defaultDictionaryValueColumn(['编号', '名称'])).toBe(1)
    expect(defaultDictionaryValueColumn(['编号', '选项'])).toBe(1)
  })

  it('prefers the explicit 字典值 header and has a predictable fallback', () => {
    expect(defaultDictionaryValueColumn(['名称', '字典值'])).toBe(1)
    expect(defaultDictionaryValueColumn(['自定义列', '备注'])).toBe(0)
    expect(defaultDictionaryValueColumn([])).toBe(-1)
  })

  it('preserves actual spreadsheet rows after multirow headers and blank cells', () => {
    expect(dictionaryRecordsFromSheet(sheet, 1)).toEqual([
      { sourceRow: 6, value: '华东' },
      { sourceRow: 8, value: '华南' },
    ])
  })

  it('uses the user-selected source column rather than the default column', () => {
    expect(dictionaryRecordsFromSheet(sheet, 0)).toEqual([
      { sourceRow: 6, value: '1' },
      { sourceRow: 7, value: '2' },
      { sourceRow: 8, value: '3' },
      { sourceRow: 9, value: '4' },
    ])
  })

  it('rejects absent, fractional and out-of-range columns', () => {
    for (const column of [-1, 0.5, 2, NaN]) {
      expect(() => dictionaryRecordsFromSheet(sheet, column)).toThrow('请选择字典值所在的列')
    }
  })

  it('reads an actual CSV and keeps quoted commas inside the value', async () => {
    const parsed = await parseExcelFile(new File(['序号,字典值\r\n1,"区域,华东"\r\n2,华南'], '区域.csv'))
    expect(dictionaryRecordsFromSheet(parsed, defaultDictionaryValueColumn(parsed.headers))).toEqual([
      { sourceRow: 2, value: '区域,华东' },
      { sourceRow: 3, value: '华南' },
    ])
  })
})

describe('dictionary value paste parsing', () => {
  it('trims values and ignores blanks without losing original line numbers', () => {
    expect(dictionaryRecordsFromPaste('\n 华东 \r\n \r华南\n华北\n')).toEqual([
      { sourceRow: 2, value: '华东' },
      { sourceRow: 4, value: '华南' },
      { sourceRow: 5, value: '华北' },
    ])
  })

  it('keeps duplicates, casing, long values and punctuation for server precheck', () => {
    const longValue = '长'.repeat(256)
    expect(dictionaryRecordsFromPaste(`WAF\nwaf\n区域,华东\n${longValue}`)).toEqual([
      { sourceRow: 1, value: 'WAF' },
      { sourceRow: 2, value: 'waf' },
      { sourceRow: 3, value: '区域,华东' },
      { sourceRow: 4, value: longValue },
    ])
  })

  it('returns no records for empty or whitespace-only input', () => {
    expect(dictionaryRecordsFromPaste(' \n\t\r\n')).toEqual([])
    expect(dictionaryRecordsFromSheet({ ...sheet, rows: [['', ' ']], totalRows: 1 }, 1)).toEqual([])
  })

  it('accepts the limit, including ignored blank lines, and rejects larger batches', () => {
    const maximum = Array.from({ length: MAX_DICTIONARY_IMPORT_ROWS }, (_, index) => `值${index}`).join('\n')
    expect(dictionaryRecordsFromPaste(`\n${maximum}\n\n`)).toHaveLength(MAX_DICTIONARY_IMPORT_ROWS)
    expect(() => dictionaryRecordsFromPaste(`${maximum}\n超出`)).toThrow('最多导入 5000')
    const oversizedSheet = {
      ...sheet,
      rows: Array.from({ length: MAX_DICTIONARY_IMPORT_ROWS + 1 }, () => ['1', '值']),
      totalRows: MAX_DICTIONARY_IMPORT_ROWS + 1,
    }
    expect(() => dictionaryRecordsFromSheet(oversizedSheet, 1)).toThrow('最多导入 5000')
  })
})
