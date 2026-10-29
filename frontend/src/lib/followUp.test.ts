import { describe, expect, it } from 'vitest'
import { DEFAULT_FOLLOW_UP_POLICY as policy, followUpReminder, formatFollowUpTime, parseFixedTarget } from './followUp'

const base = { fixedTarget: true, projectStatus: '方案设计' as const, deleted: false, createdAt: '2026-09-01T12:00:00', lastFollowUpAt: '2026-10-22T23:59:59' }
describe('固定靶跟进提醒', () => {
  it('按上海自然日计算，第7天开始提醒，第8天逾期', () => {
    expect(followUpReminder(base, policy, '2026-10-28')).toMatchObject({ due: false, days: 6, dueDate: '2026-10-29' })
    expect(followUpReminder(base, policy, '2026-10-29')).toMatchObject({ due: true, overdueDays: 0, label: '今天需跟进' })
    expect(followUpReminder(base, policy, '2026-10-30')).toMatchObject({ due: true, overdueDays: 1 })
  })
  it('非固定靶第14天；风险级别不参与计算；中标与回收站不提醒', () => {
    const normal = { ...base, fixedTarget: false, projectLevel: '高风险' }
    expect(followUpReminder(normal, policy, '2026-11-04').due).toBe(false)
    expect(followUpReminder(normal, policy, '2026-11-05').due).toBe(true)
    expect(followUpReminder({ ...base, projectStatus: '中标' }, policy, '2026-11-20').due).toBe(false)
    expect(followUpReminder({ ...base, deleted: true }, policy, '2026-11-20').due).toBe(false)
  })
  it('缺少跟进时间用创建时间；无效日期待核对；可配置周期且不改写项目', () => {
    const project = { ...base, lastFollowUpAt: undefined }
    const before = structuredClone(project)
    expect(followUpReminder(project, { fixedTargetDays: 60, normalDays: 90 }, '2026-10-29').due).toBe(false)
    expect(followUpReminder(project, policy, '2026-10-29').days).toBe(58)
    expect(project).toEqual(before)
    expect(followUpReminder({ ...project, createdAt: '2026-02-30' }, policy, '2026-10-29')).toMatchObject({ due: false, label: '跟进时间待核对' })
  })
  it('带时区的演示时间转换为上海日期，跨年亦正确', () => {
    expect(formatFollowUpTime('2026-12-31T16:00:00Z')).toBe('2027-01-01 00:00:00')
    expect(formatFollowUpTime('2026-10-29T12:05:00')).toBe('2026-10-29 12:05:00')
    expect(followUpReminder({ ...base, lastFollowUpAt: '2026-12-31T16:00:00Z' }, policy, '2027-01-07').due).toBe(false)
    expect(followUpReminder({ ...base, lastFollowUpAt: '2026-12-31T16:00:00Z' }, policy, '2027-01-08').due).toBe(true)
  })
  it('固定靶不是非空即是：严格解析是/否等，未知值不能自动猜测', () => {
    for (const value of [true, '是', 'true', 'YES', 1]) expect(parseFixedTarget(value)).toBe(true)
    for (const value of [false, '否', 'false', 'no', 0, '', null]) expect(parseFixedTarget(value)).toBe(false)
    for (const value of ['待定', '非空', 2, '重点']) expect(parseFixedTarget(value)).toBeNull()
  })
})
