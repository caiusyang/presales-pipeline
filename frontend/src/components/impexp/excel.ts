import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import type { ExportColumn } from '@/types'

// ============================================================
// SheetJS 封装：Excel 解析（导入）与生成（导出 / 示例文件），全部在前端完成
// ============================================================

export interface ParsedSheet {
  sheetName: string
  headers: string[]
  /** Excel 中实际占用的表头行数（合并多级表头会大于 1） */
  headerRows: number
  /** 第一条数据在 Excel 中的 1-based 行号 */
  dataStartRow: number
  /** 数据行（不含表头），单元格已统一为 string */
  rows: string[][]
  totalRows: number
}

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024
export const MAX_IMPORT_ROWS = 5_000
export const MAX_IMPORT_COLUMNS = 200
const MAX_IMPORT_HEADER_ROWS = 20

const SUPPORTED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv']

export function validateImportFile(file: Pick<File, 'name' | 'size'>): void {
  const name = file.name.toLowerCase()
  if (!SUPPORTED_IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    throw new Error('仅支持 .xlsx、.xls 或 .csv 文件')
  }
  if (file.size === 0) throw new Error('文件为空')
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`文件不能超过 ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB`)
  }
}

/** 单元格统一转 string（number/Date/string/空 → string） */
export function cellToString(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return dayjs(v).format('YYYY-MM-DD')
  return String(v)
}

function inferHeaderRowCount(range: XLSX.Range, merges: XLSX.Range[]): number {
  let headerEnd = range.s.r
  let changed = true

  // 从首个有效行开始，只沿与当前表头区域相连的合并单元格向下展开。
  // 横向合并表示下一行仍是下一级表头；纵向合并直接给出表头终止行。
  while (changed) {
    changed = false
    for (const merge of merges) {
      if (merge.s.r < range.s.r || merge.s.r > headerEnd || merge.s.c > range.e.c || merge.e.c < range.s.c) continue
      const nextEnd = Math.max(merge.e.r, merge.e.c > merge.s.c ? merge.s.r + 1 : merge.e.r)
      const boundedEnd = Math.min(nextEnd, range.e.r)
      if (boundedEnd > headerEnd) {
        headerEnd = boundedEnd
        changed = true
      }
    }
  }

  return headerEnd - range.s.r + 1
}

function fillMergedCells(grid: string[][], range: XLSX.Range, merges: XLSX.Range[]): void {
  for (const merge of merges) {
    const startRow = Math.max(merge.s.r, range.s.r)
    const endRow = Math.min(merge.e.r, range.e.r)
    const startCol = Math.max(merge.s.c, range.s.c)
    const endCol = Math.min(merge.e.c, range.e.c)
    if (startRow > endRow || startCol > endCol) continue

    const anchor = grid[merge.s.r - range.s.r]?.[merge.s.c - range.s.c]?.trim() ?? ''
    if (!anchor) continue
    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        const relativeRow = row - range.s.r
        const relativeCol = col - range.s.c
        if (!grid[relativeRow][relativeCol].trim()) grid[relativeRow][relativeCol] = anchor
      }
    }
  }
}

function buildHeaders(grid: string[][], headerRowCount: number): string[] {
  const columnCount = grid[0]?.length ?? 0
  const used = new Map<string, number>()

  return Array.from({ length: columnCount }, (_, column) => {
    const parts: string[] = []
    for (let row = 0; row < headerRowCount; row += 1) {
      const part = grid[row]?.[column]?.trim() ?? ''
      if (part && !parts.includes(part)) parts.push(part)
    }
    const base = parts.join(' / ') || `列${column + 1}`
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    return count === 0 ? base : `${base}(${count + 1})`
  })
}

/** 解析上传的首个工作表；支持按合并关系还原多行分级表头。 */
export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  validateImportFile(file)
  const buf = await file.arrayBuffer()
  const isCsv = file.name.toLowerCase().endsWith('.csv')
  const source = isCsv ? new TextDecoder('utf-8').decode(buf) : buf
  const wb = XLSX.read(source, {
    type: isCsv ? 'string' : 'array',
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
  })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('文件中没有工作表')
  const sheet = wb.Sheets[sheetName]
  if (!sheet['!ref']) throw new Error('第一个工作表为空或缺少表头行')

  const range = XLSX.utils.decode_range(sheet['!ref'])
  const totalUsedRows = range.e.r - range.s.r + 1
  const columnCount = range.e.c - range.s.c + 1
  if (totalUsedRows > MAX_IMPORT_ROWS + MAX_IMPORT_HEADER_ROWS) {
    throw new Error(`数据不能超过 ${MAX_IMPORT_ROWS} 行`)
  }
  if (columnCount > MAX_IMPORT_COLUMNS) throw new Error(`列数不能超过 ${MAX_IMPORT_COLUMNS} 列`)

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: '' })
  const grid = Array.from({ length: totalUsedRows }, (_, row) =>
    Array.from({ length: columnCount }, (_, column) => cellToString(aoa[row]?.[column])),
  )
  if (!grid.length || grid[0].every((c) => c.trim() === '')) {
    throw new Error('第一个工作表为空或缺少表头行')
  }

  const merges = sheet['!merges'] ?? []
  const headerRows = inferHeaderRowCount(range, merges)
  if (headerRows > MAX_IMPORT_HEADER_ROWS) throw new Error(`合并表头不能超过 ${MAX_IMPORT_HEADER_ROWS} 行`)
  fillMergedCells(grid, range, merges)

  const headers = buildHeaders(grid, headerRows)
  const rows = grid.slice(headerRows)
  // 仅移除末尾因格式残留进入 !ref 的空行，保留数据中间的空行以维持 Excel 行号。
  while (rows.at(-1)?.every((cell) => cell.trim() === '')) rows.pop()
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`数据不能超过 ${MAX_IMPORT_ROWS} 行`)
  return {
    sheetName,
    headers,
    headerRows,
    dataStartRow: range.s.r + headerRows + 1,
    rows,
    totalRows: rows.length,
  }
}

/** 估算列宽（按标题长度，中文按 2 字符宽估算） */
function colWidth(title: string): number {
  return Math.min(40, Math.max(10, title.length * 2 + 4))
}

/** 生成并下载导入示例文件 */
export function downloadImportSample(): void {
  const header = ['编号', '客户', '项目', '行业', '赛道', '方案', '进展', '2026-08收入']
  const rows = [
    ['EXT-001', '华信银行', '核心系统安全改造', '金融-银行', '安全建设', '零信任方案', '2026-08-01：完成POC\n2026-08-10：提交投标方案', '120'],
    ['EXT-002', '云顶能源', '调度平台升级', '能源-电网', '数字化转型', '数据底座方案', '2026-08-05：完成需求调研', '85.5'],
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = header.map((h) => ({ wch: colWidth(h) + 6 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入示例')
  XLSX.writeFile(wb, '导入示例.xlsx')
}

/** 按列配置生成 xlsx 并下载：首行为 title，数据按 columns.key 取值 */
export function downloadExportXlsx(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string,
): void {
  const aoa: unknown[][] = [columns.map((c) => c.title)]
  for (const row of rows) {
    aoa.push(columns.map((c) => row[c.key] ?? ''))
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = columns.map((c) => ({ wch: colWidth(c.title) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename)
}
