import { MAX_IMPORT_ROWS, type ParsedSheet } from '@/components/impexp/excel'

export interface DictionaryImportRecord {
  sourceRow: number
  value: string
}

export const MAX_DICTIONARY_IMPORT_ROWS = MAX_IMPORT_ROWS

/** Prefer a value/name column while keeping the user's column choice explicit. */
export function defaultDictionaryValueColumn(headers: string[]): number {
  const preferred = ['字典值', '字典选项', '选项', '名称', 'value']
  for (const name of preferred) {
    const index = headers.findIndex((header) => header.trim().toLowerCase() === name)
    if (index >= 0) return index
  }
  return headers.length ? 0 : -1
}

function checkRecordCount(records: DictionaryImportRecord[]): DictionaryImportRecord[] {
  if (records.length > MAX_DICTIONARY_IMPORT_ROWS) {
    throw new Error(`每次最多导入 ${MAX_DICTIONARY_IMPORT_ROWS} 个字典值，请分批导入`)
  }
  return records
}

/** Blank lines are ignored without renumbering subsequent source rows. */
export function dictionaryRecordsFromPaste(text: string): DictionaryImportRecord[] {
  return checkRecordCount(text.split(/\r\n|\n|\r/).flatMap((line, index) => {
    const value = line.trim()
    return value ? [{ sourceRow: index + 1, value }] : []
  }))
}

export function dictionaryRecordsFromSheet(sheet: ParsedSheet, column: number): DictionaryImportRecord[] {
  if (!Number.isInteger(column) || column < 0 || column >= sheet.headers.length) {
    throw new Error('请选择字典值所在的列')
  }
  return checkRecordCount(sheet.rows.flatMap((row, index) => {
    const value = (row[column] ?? '').trim()
    return value ? [{ sourceRow: sheet.dataStartRow + index, value }] : []
  }))
}
