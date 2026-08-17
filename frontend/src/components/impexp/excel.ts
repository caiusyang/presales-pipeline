import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import type { ExportColumn } from '@/types'

// ============================================================
// SheetJS 封装：Excel 解析（导入）与生成（导出 / 示例文件），全部在前端完成
// ============================================================

export interface ParsedSheet {
  sheetName: string
  headers: string[]
  /** 数据行（不含表头），单元格已统一为 string */
  rows: string[][]
  totalRows: number
}

/** 单元格统一转 string（number/Date/string/空 → string） */
export function cellToString(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return dayjs(v).format('YYYY-MM-DD')
  return String(v)
}

/** 解析上传的 xlsx/xls/csv 第一个 sheet；首行为表头（重名/空表头自动改名） */
export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('文件中没有工作表')
  const sheet = wb.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
  const grid = aoa.map((r) => (Array.isArray(r) ? r : []).map(cellToString))
  if (!grid.length || grid[0].every((c) => c.trim() === '')) {
    throw new Error('第一个工作表为空或缺少表头行')
  }
  const seen = new Map<string, number>()
  const headers = grid[0].map((h, i) => {
    const base = h.trim() || `列${i + 1}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n === 0 ? base : `${base}(${n + 1})`
  })
  const rows = grid.slice(1)
  return { sheetName, headers, rows, totalRows: rows.length }
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
