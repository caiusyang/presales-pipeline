export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function actionReminder(date: string | null | undefined, today = businessDate()) {
  if (!date) return { label: '未安排', days: null, group: 3, tone: 'text-muted-foreground' }
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  if (days < 0) return { label: `逾期 ${-days} 天`, days, group: 0, tone: 'border-red-400 bg-red-50 text-red-700 font-semibold' }
  if (days === 0) return { label: '今天到期', days, group: 1, tone: 'bg-orange-200 text-orange-950 font-semibold' }
  if (days === 1) return { label: '明天到期', days, group: 2, tone: 'bg-orange-100 text-orange-800' }
  if (days <= 7) return { label: `剩余 ${days} 天`, days, group: 2, tone: 'bg-yellow-50 text-yellow-800' }
  return { label: `剩余 ${days} 天`, days, group: 2, tone: '' }
}
export function compareActions(a: { id: number; nextActionDate?: string | null }, b: { id: number; nextActionDate?: string | null }, today = businessDate()) {
  return actionReminder(a.nextActionDate, today).group - actionReminder(b.nextActionDate, today).group || (a.nextActionDate ?? '').localeCompare(b.nextActionDate ?? '') || a.id - b.id
}
