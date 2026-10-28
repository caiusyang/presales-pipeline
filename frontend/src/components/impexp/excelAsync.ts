import type { ParsedSheet } from './excel'
import type { ExportColumn } from '@/types'

async function workerResult<T>(input: unknown): Promise<T> {
  const worker = new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('文件处理超时，请缩小文件后重试')) }, 120000)
    const close = () => { clearTimeout(timeout); worker.terminate() }
    worker.onmessage = ({ data }) => { close(); if (data.error) reject(new Error(data.error)); else resolve(data.result) }
    worker.onerror = () => { close(); reject(new Error('文件处理线程失败，请重试')) }
    worker.postMessage(input)
  })
}

export async function parseExcelFileAsync(file: File): Promise<ParsedSheet> {
  return typeof Worker === 'undefined' ? (await import('./excel')).parseExcelFile(file) : workerResult({ action: 'parse', file })
}

export async function downloadExportXlsxAsync(columns: ExportColumn[], rows: Record<string, unknown>[], sheetName: string, filename: string): Promise<void> {
  const started = performance.now()
  let buffer: ArrayBuffer
  if (typeof Worker !== 'undefined') buffer = await workerResult({ action: 'export', columns, rows, sheetName })
  else { const XLSX = await import('xlsx'); const { buildExportWorkbook } = await import('./excel'); buffer = XLSX.write(buildExportWorkbook(columns, rows, sheetName), { type: 'array', bookType: 'xlsx', cellStyles: true }) as ArrayBuffer }
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  performance.measure('excel-generation', { start: started, end: performance.now() })
}
