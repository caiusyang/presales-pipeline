import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { isJobRunning, taskChanged } from '@/api/jobs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { ExportResult } from '@/api/types'
import { downloadExportXlsxAsync } from '@/components/impexp/excelAsync'
import { toast } from 'sonner'

const labels: Record<string, string> = { PROJECT_DELETE: '批量移入回收站', PROJECT_RESTORE: '批量恢复', PROJECT_PURGE: '批量永久删除', IMPORT: '正式导入', PREFLIGHT: '导入预检', EXPORT: '导出', PROGRESS_REPAIR: '历史进展修复', PEOPLE_IMPORT: '责任人库导入' }
const states: Record<string, string> = { QUEUED: '等待执行', RUNNING: '执行中', SUCCEEDED: '完成', PARTIAL: '部分完成', FAILED: '失败', INTERRUPTED: '已中断' }

export function TaskCenter() {
  const qc = useQueryClient(), [open, setOpen] = useState(false), [selected, setSelected] = useState<string | null>(null), [page, setPage] = useState(0)
  const previous = useRef(new Map<string, string>())
  const jobs = useQuery({ queryKey: ['background-jobs'], queryFn: () => api.listJobs(), refetchInterval: (q) => q.state.data?.some(isJobRunning) ? 1000 : 10000 })
  const details = useQuery({ queryKey: ['background-job-items', selected, page, jobs.data?.find((j) => j.id === selected)?.updatedAt], queryFn: () => api.getJobItems(selected!, page), enabled: open && selected != null })
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ['background-jobs'] }) }
    window.addEventListener('presales:tasks-changed', refresh)
    return () => window.removeEventListener('presales:tasks-changed', refresh)
  }, [qc])
  useEffect(() => {
    let finished = false
    for (const job of jobs.data ?? []) { if (['QUEUED', 'RUNNING'].includes(previous.current.get(job.id) ?? '') && !isJobRunning(job)) finished = true; previous.current.set(job.id, job.status) }
    if (finished) void qc.invalidateQueries({ predicate: (q) => !String(q.queryKey[0]).startsWith('background-job') })
  }, [jobs.data, qc])
  const retry = useMutation({ mutationFn: (id: string) => api.retryJob(id, crypto.randomUUID()), onSuccess: taskChanged, onError: (e) => toast.error(e.message) })
  const download = useMutation({ mutationFn: async (id: string) => { const result = await api.getJobResult(id) as ExportResult; await downloadExportXlsxAsync(result.columns, result.rows, '任务导出', `项目导出-${id.slice(0, 8)}.xlsx`) }, onError: (e) => toast.error(e.message) })
  const active = jobs.data?.filter(isJobRunning).length ?? 0
  return <>
    <Button variant="outline" size="sm" className="fixed right-5 bottom-4 z-30 bg-background shadow-md" onClick={() => setOpen(true)}>后台任务{active ? `（执行中 ${active}）` : ''}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>后台任务</DialogTitle><DialogDescription>每批 100 条、最多同时执行 2 个任务。刷新页面后可继续查看；服务中断保留成功项，重试只处理未成功项。</DialogDescription></DialogHeader>
      {jobs.isError && <p role="alert">任务加载失败，<button className="underline" onClick={() => void jobs.refetch()}>重新加载</button></p>}
      <div className="max-h-64 space-y-2 overflow-auto">{jobs.data?.map((job) => <div key={job.id} className="rounded-md border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><b>{labels[job.kind] ?? job.kind} · {states[job.status]}</b><span>总数 {job.total} / 已处理 {job.processed} / 成功 {job.succeeded} / 失败 {job.failed}</span></div>
        <progress className="mt-2 h-2 w-full" max={Math.max(1, job.total)} value={job.processed} />
        <p className="break-all text-xs text-muted-foreground">任务编号 {job.id}</p>{job.error && <p className="text-destructive">{job.error}</p>}
        <div className="mt-2 flex gap-2"><Button size="xs" variant="outline" onClick={() => { setSelected(job.id); setPage(0) }}>查看逐项结果</Button>
          {!isJobRunning(job) && job.status !== 'SUCCEEDED' && <Button size="xs" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(job.id)}>重试未成功项</Button>}
          {job.kind === 'EXPORT' && job.status === 'SUCCEEDED' && <Button size="xs" disabled={download.isPending} onClick={() => download.mutate(job.id)}>下载导出结果</Button>}
        </div>
      </div>)}{jobs.data?.length === 0 && <p className="py-4 text-center text-muted-foreground">暂无任务</p>}</div>
      {selected && <section className="space-y-2 border-t pt-3"><h3 className="text-sm font-medium">逐项结果</h3>{details.isError && <p role="alert">结果加载失败，请重试</p>}
        <div className="max-h-56 overflow-auto text-xs">{details.data?.items.map((row) => <div className="border-b py-2" key={row.index}><b>第 {row.index + 1} 项 · {row.status === 'SUCCESS' ? '成功' : row.status === 'FAILED' ? '失败' : '尚未处理'}</b><span className="ml-3 break-all">{typeof row.input === 'number' ? `项目 ${row.input}` : `源行 ${(row.input as { sourceRow?: number })?.sourceRow ?? '—'}`}</span>{row.error && <p className="text-destructive">{row.error}</p>}</div>)}</div>
        <div className="flex items-center justify-end gap-2 text-xs"><span>共 {details.data?.total ?? 0} 项，第 {page + 1} 页</span><Button size="xs" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</Button><Button size="xs" variant="outline" disabled={(page + 1) * 100 >= (details.data?.total ?? 0)} onClick={() => setPage(page + 1)}>下一页</Button></div>
      </section>}
    </DialogContent></Dialog>
  </>
}
