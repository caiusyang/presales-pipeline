import { describe, expect, it } from 'vitest'
import { MAX_IMPORT_FILE_BYTES, validateImportFile } from './excel'

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
})
