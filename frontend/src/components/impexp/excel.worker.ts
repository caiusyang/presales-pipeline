/// <reference lib="webworker" />
import * as XLSX from 'xlsx'
import { parseExcelFile, buildExportWorkbook } from './excel'

const worker = self as unknown as DedicatedWorkerGlobalScope
worker.onmessage = async ({ data }) => {
  try {
    if (data.action === 'parse') worker.postMessage({ result: await parseExcelFile(data.file) })
    else {
      const wb = buildExportWorkbook(data.columns, data.rows, data.sheetName)
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as ArrayBuffer
      worker.postMessage({ result: buffer }, [buffer])
    }
  } catch (error) { worker.postMessage({ error: (error as Error).message || '文件处理失败' }) }
}
