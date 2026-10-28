import { describe, expect, it } from 'vitest'
import { parseProgressCell } from './progressDate'
import { buildImportRecords } from '@/components/impexp/importTransform'

describe('进展日期严格解析', () => {
  it.each(['2026-09-13','2026/9/13','2026.9.13','2026年9月13日'])('识别完整日期 %s', (date) => {
    expect(parseProgressCell(`${date}：完成交流`).entries).toEqual([{ logDate:'2026-09-13',content:'完成交流' }])
  })
  it.each(['9月13日','09/13'])('使用显式默认年份而非当前年份 %s', (date) => {
    expect(parseProgressCell(`${date}：完成交流`,2025)).toEqual({entries:[{logDate:'2025-09-13',content:'完成交流'}],issues:[]})
    expect(parseProgressCell(`${date}：完成交流`).issues[0].message).toContain('默认年份')
  })
  it('新日期分段，保留续行和跨年，不静默接上错误日期后的内容', () => {
    const result = parseProgressCell('2025-12-31：交流\n技术续行\n\n2026-01-01：新年沟通\n2026-02-30：无效\n错误后的内容',2025)
    expect(result.entries).toEqual([{logDate:'2025-12-31',content:'交流\n技术续行'},{logDate:'2026-01-01',content:'新年沟通'}])
    expect(result.issues).toHaveLength(2)
  })
  it('拒绝无日期首段、非法日期、无法识别的日期和空内容，正确处理闰年', () => {
    for (const text of ['只有内容','2026-02-30：错误','2026-13-01：错误','2026-2-29：错误','2026-9：日期残缺','2026-09-13：']) expect(parseProgressCell(text).issues.length).toBeGreaterThan(0)
    expect(parseProgressCell('2024-2-29：闰年').entries[0].logDate).toBe('2024-02-29')
  })
  it('预检保留原行号，将日期错误置为本地阻断问题', () => {
    const params = {headers:['进展'],rows:[['9月13日：交流'],['2026-02-30：错误']],columnMap:{进展:'progressText'},valueRules:[],today:'2026-10-28',defaultYear:2025,dataStartRow:6}
    const result = buildImportRecords(params)
    expect(result.records[0].progress[0].logDate).toBe('2025-09-13')
    expect(result.problems).toContainEqual(expect.objectContaining({excelRow:7,field:'source:0'}))
    expect(result.records[1].progress).toEqual([])
  })
})
