import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useProjectMutations } from '@/hooks/queries'
import type { Project } from '@/types'
export function CompleteActionDialog({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const [date, setDate] = useState(''), [note, setNote] = useState(''), { completeAction } = useProjectMutations()
  useEffect(() => { setDate(''); setNote('') }, [project?.id])
  return <Dialog open={project != null} onOpenChange={(open) => !open && !completeAction.isPending && onClose()}><DialogContent><DialogHeader><DialogTitle>完成本次行动</DialogTitle><DialogDescription>{project?.projectName}：原行动 {project?.nextActionDate ?? '未安排'}，{project?.nextActionNote || '未填写内容'}。不填下次日期将清空安排；也可直接安排下一次行动，所有变化记入日志。</DialogDescription></DialogHeader>
    <Label htmlFor="complete-next-date">下一次行动日期（可留空）</Label><Input id="complete-next-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
    <Label htmlFor="complete-next-note">下一次行动内容</Label><Textarea id="complete-next-note" value={note} onChange={(e) => setNote(e.target.value)} />
    <DialogFooter><Button variant="outline" disabled={completeAction.isPending} onClick={onClose}>取消</Button><Button disabled={completeAction.isPending} onClick={() => project && completeAction.mutate({ id: project.id, nextActionDate: date || null, nextActionNote: note }, { onSuccess: onClose })}>确认完成</Button></DialogFooter>
  </DialogContent></Dialog>
}
