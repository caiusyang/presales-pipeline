import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFollowUpPolicy, useSaveFollowUpPolicy } from '@/hooks/queries'

export function FollowUpPolicyManager() {
  const policyQ = useFollowUpPolicy(), save = useSaveFollowUpPolicy()
  const [fixedDays, setFixedDays] = useState(''), [normalDays, setNormalDays] = useState('')
  useEffect(() => { if (policyQ.data) { setFixedDays(String(policyQ.data.fixedTargetDays)); setNormalDays(String(policyQ.data.normalDays)) } }, [policyQ.data])
  const valid = [fixedDays, normalDays].every((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 3650)
  const changed = Number(fixedDays) !== policyQ.data?.fixedTargetDays || Number(normalDays) !== policyQ.data?.normalDays
  return <section className="space-y-4 rounded-md border p-4">
    <div><h2 className="font-medium">跟进周期</h2><p className="mt-1 text-sm text-muted-foreground">按是否固定靶关联周期，仅提醒未中标且未删除的项目。项目级别（无风险、低风险、高风险）独立维护。</p></div>
    {policyQ.isError ? <p role="alert" className="text-sm text-destructive">读取失败，无法修改。<Button variant="link" onClick={() => void policyQ.refetch()}>重试</Button></p> : <>
      <div className="grid max-w-lg gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="fixed-target-days">固定靶跟进周期（天）</Label><Input id="fixed-target-days" type="number" min="1" max="3650" step="1" value={fixedDays} onChange={(e) => setFixedDays(e.target.value)} disabled={!policyQ.data || save.isPending} /></div>
        <div className="space-y-2"><Label htmlFor="normal-follow-up-days">非固定靶跟进周期（天）</Label><Input id="normal-follow-up-days" type="number" min="1" max="3650" step="1" value={normalDays} onChange={(e) => setNormalDays(e.target.value)} disabled={!policyQ.data || save.isPending} /></div>
      </div>
      {!valid && policyQ.data && <p role="alert" className="text-sm text-destructive">请输入 1—3650 天的整数。</p>}
      <Button disabled={!policyQ.data || !valid || !changed || save.isPending} onClick={() => save.mutate({ fixedTargetDays: Number(fixedDays), normalDays: Number(normalDays) })}>{save.isPending ? '保存中…' : '保存跟进周期'}</Button>
    </>}
    <p className="text-sm text-muted-foreground">按上海自然日计算，到周期当天开始提醒。基准是最后一次实际业务变更时间；没有该时间时使用项目创建时间。查看、导出和无变化保存不重置周期；修改周期也不会改写项目跟进时间。下次行动日期提醒仍单独保留。</p>
  </section>
}
