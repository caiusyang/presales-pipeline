import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { waitForJob } from '@/api/jobs'
import type { ProgressRepairInput } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { toast } from 'sonner'
import type { BatchDeleteProjectsResult } from '@/components/project/batchDeleteProjects'

export function ProgressRepairManager() {
  const [page, setPage] = useState(0), [selected, setSelected] = useState<Set<number>>(new Set()), [edits, setEdits] = useState<Record<number, { date: string; evidence: string }>>({}), [confirm, setConfirm] = useState(false)
  const qc = useQueryClient(), preview = useQuery({ queryKey: ['progress-repair', page], queryFn: () => api.previewProgressRepairs(page) })
  const repairs: ProgressRepairInput[] = (preview.data?.items ?? []).filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, expectedLogDate: r.logDate, expectedContent: r.content, logDate: edits[r.id]?.date || r.proposedDate || '', content: r.proposedContent || r.content, evidence: edits[r.id]?.evidence || (r.classification === 'repairable' ? `原文完整日期：${r.proposedDate}` : '') }))
  const run = useMutation({ mutationFn: async () => waitForJob<BatchDeleteProjectsResult>(api, await api.startProgressRepairJob({ requestId: crypto.randomUUID(), repairs })), onSuccess: (r) => { setSelected(new Set()); setConfirm(false); void qc.invalidateQueries(); toast.success(`修复 ${r.deletedIds.length} 条，未完成 ${r.failures.length} 条，详见后台任务`) }, onError: (e) => toast.error(e.message) })
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">仅原文含可验证的完整日期时提供自动建议。其他记录必须核对原始文件，人工填写日期与依据；不根据录入时间或升级时间猜测。修改不会改变录入时间。</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setSelected(new Set(preview.data?.items.filter((r) => r.classification === 'repairable').map((r) => r.id)))}>选择本页可依据原文修复项</Button><Button disabled={!repairs.length || repairs.some((r) => !r.logDate || !r.evidence) || run.isPending} onClick={() => setConfirm(true)}>预览确认修复 {repairs.length} 条</Button></div>
    {preview.isError && <p role="alert">读取失败，<button className="underline" onClick={() => void preview.refetch()}>重新加载</button></p>}
    <div className="space-y-2">{preview.data?.items.map((row) => <div key={row.id} className="space-y-2 rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><input type="checkbox" aria-label={`选择进展 ${row.id}`} checked={selected.has(row.id)} disabled={row.classification === 'verified' || run.isPending} onChange={(e) => setSelected((current) => { const next = new Set(current); if (e.target.checked) next.add(row.id); else next.delete(row.id); return next })} /><b>{row.projectName}</b><span>原进展日期 {row.logDate}</span><span className="text-xs text-muted-foreground">录入时间 {row.createdAt.replace('T', ' ')}</span></div>
      <p className="whitespace-pre-wrap text-xs">{row.content}</p><p className={row.classification === 'manual' ? 'text-amber-700' : 'text-muted-foreground'}>{row.reason}</p>
      {row.classification !== 'verified' && <div className="flex flex-wrap gap-2"><Input type="date" className="w-40" aria-label={`修复日期 ${row.id}`} value={edits[row.id]?.date ?? row.proposedDate ?? ''} onChange={(e) => setEdits({ ...edits, [row.id]: { date: e.target.value, evidence: edits[row.id]?.evidence ?? '' } })} /><Input className="min-w-64 flex-1" aria-label={`修复依据 ${row.id}`} placeholder="人工修复须填写依据，如原文件名/工作表/行号/确认的年份" value={edits[row.id]?.evidence ?? ''} onChange={(e) => setEdits({ ...edits, [row.id]: { date: edits[row.id]?.date ?? row.proposedDate ?? '', evidence: e.target.value } })} /></div>}
    </div>)}</div>
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm"><span>共 {preview.data?.total ?? 0} 条，第 {page + 1} 页</span><Button variant="outline" disabled={page === 0 || run.isPending} onClick={() => { setPage(page - 1); setSelected(new Set()) }}>上一页</Button><Button variant="outline" disabled={(page + 1) * 100 >= (preview.data?.total ?? 0) || run.isPending} onClick={() => { setPage(page + 1); setSelected(new Set()) }}>下一页</Button></div>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="确认历史进展修复" description={repairs.map((r) => `进展 ${r.id}：${r.expectedLogDate} → ${r.logDate}；${r.evidence}`).join('\n')} confirmText="确认修复所选记录" loading={run.isPending} onConfirm={() => run.mutate()} />
  </div>
}
