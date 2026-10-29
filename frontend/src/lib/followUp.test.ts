import { describe, expect, it } from 'vitest'
import { DEFAULT_FOLLOW_UP_POLICY as policy, followUpReminder, formatFollowUpTime, parseFixedTarget, normalizeFollowUpPolicy, validateFollowUpPolicy, followUpFields } from './followUp'

const base = { fixedTarget: true, projectStatus: '方案设计' as const, deleted: false, createdAt: '2026-09-01T12:00:00', lastFollowUpAt: '2026-10-22T23:59:59' }
describe('固定靶跟进提醒', () => {
  it('按上海自然日计算，第7天开始提醒，第8天逾期', () => {
    expect(followUpReminder(base, policy, '2026-10-28')).toMatchObject({ due: false, days: 6, dueDate: '2026-10-29' })
    expect(followUpReminder(base, policy, '2026-10-29')).toMatchObject({ due: true, overdueDays: 0, label: '今天需跟进' })
    expect(followUpReminder(base, policy, '2026-10-30')).toMatchObject({ due: true, overdueDays: 1 })
  })
  it('非固定靶第14天；风险级别不参与计算；中标与回收站不提醒', () => {
    const normal = { ...base, fixedTarget: false, projectLevel: '高风险' as const }
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
  it('关联项目级别后不再按固定靶决定周期，空值走默认', () => {
    const configured = { ...policy, fieldKey: 'projectLevel', defaultDays: 14, rules: [{ value: '高风险', days: 3 }], fieldLabel: '项目级别' }
    expect(followUpReminder({ ...base, fixedTarget: false, projectLevel: '高风险' }, configured, '2026-10-29')).toMatchObject({ due: true, interval: 3, fieldLabel: '项目级别', matchLabel: '高风险', matched: true })
    expect(followUpReminder({ ...base, fixedTarget: true, projectLevel: '无风险' }, configured, '2026-10-29')).toMatchObject({ due: false, interval: 14, matched: false })
    expect(followUpReminder({ ...base, projectLevel: null }, configured, '2026-10-29').interval).toBe(14)
  })
  it('自定义文本完整值匹配忽略大小写/首尾空白，不适用赛道仍按默认', () => {
    const configured = { ...policy, fieldKey: 'custom.follow_class', defaultDays: 14, rules: [{ value: 'vip', days: 3 }], applicableTracks: ['HCS'] }
    const project = { ...base, track: 'HCS', customFields: { follow_class: ' VIP ' } }
    expect(followUpReminder(project, configured, '2026-10-29')).toMatchObject({ due: true, interval: 3, matched: true })
    expect(followUpReminder({ ...project, track: '公有云' }, configured, '2026-10-29')).toMatchObject({ due: false, interval: 14, matched: false })
    expect(followUpReminder({ ...project, customFields: { follow_class: 'vip客户' } }, configured, '2026-10-29').interval).toBe(14)
  })
  it('兼容旧周期，拒绝重复值、未定义字段、非法周期及非标准选项', () => {
    expect(normalizeFollowUpPolicy({ fixedTargetDays: 9, normalDays: 18 })).toMatchObject({ fieldKey: 'fixedTarget', defaultDays: 18, rules: [{ value: 'true', days: 9 }, { value: 'false', days: 18 }] })
    const fields = followUpFields([{ id: 1, fieldKey: 'level', label: '分级', fieldType: 'text', required: false, options: [], sortOrder: 1 }], [])
    const configured = { ...policy, fieldKey: 'custom.level', defaultDays: 14, rules: [{ value: 'VIP', days: 3 }] }
    expect(validateFollowUpPolicy(configured, fields)).toBeNull()
    expect(validateFollowUpPolicy({ ...configured, rules: [...configured.rules, { value: 'vip', days: 7 }] }, fields)).toContain('重复')
    expect(validateFollowUpPolicy({ ...configured, defaultDays: 1.5 }, fields)).toContain('整数')
    expect(validateFollowUpPolicy({ ...configured, fieldKey: 'securityBudget' }, fields)).toContain('不存在')
    expect(validateFollowUpPolicy({ ...configured, fieldKey: 'projectLevel' }, fields)).toContain('选项')
  })
})
