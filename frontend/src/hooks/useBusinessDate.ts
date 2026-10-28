import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { businessDate } from '@/lib/actions'
export function useBusinessDate() {
  const [today, setToday] = useState(businessDate), qc = useQueryClient()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => { setToday(businessDate()); void qc.invalidateQueries({ queryKey: ['projects'] }); schedule() }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(refresh, 86400000 - (Date.now() + 8 * 3600000) % 86400000 + 50) }
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    schedule(); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible)
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [qc])
  return today
}
