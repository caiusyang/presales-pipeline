import { describe, expect, it } from 'vitest'
import { actionReminder, businessDate, compareActions } from './actions'
describe('行动提醒', () => {
  const today = '2026-10-28'
  it('按上海时区跨日，而不是电脑时区或UTC日期', () => {
    expect(businessDate(new Date('2026-10-28T15:59:59Z'))).toBe('2026-10-28')
    expect(businessDate(new Date('2026-10-28T16:00:00Z'))).toBe('2026-10-29')
  })
  it('覆盖逾期、今天、明天、2到7天、超过7天、未安排', () => {
    expect(actionReminder('2026-10-27', today).label).toBe('逾期 1 天')
    expect(actionReminder('2026-10-28', today).label).toBe('今天到期')
    expect(actionReminder('2026-10-29', today).label).toBe('明天到期')
    expect(actionReminder('2026-11-04', today).tone).toContain('yellow')
    expect(actionReminder('2026-11-05', today).tone).toBe('')
    expect(actionReminder(null, today).label).toBe('未安排')
  })
  it('稳定的逾期优先与日期/id排序', () => {
    const rows = [{ id: 5, nextActionDate: null }, { id: 3, nextActionDate: '2026-10-29' }, { id: 2, nextActionDate: '2026-10-28' }, { id: 4, nextActionDate: '2026-10-27' }, { id: 1, nextActionDate: '2026-10-27' }]
    expect(rows.sort((a, b) => compareActions(a, b, today)).map((r) => r.id)).toEqual([1, 4, 2, 3, 5])
  })
})
