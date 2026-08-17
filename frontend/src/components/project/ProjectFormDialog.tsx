import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProjectFormFields } from '@/components/project/ProjectFormFields'
import { emptyProjectInput, normalizeForSubmit, validateProjectInput } from '@/components/project/project-utils'
import { useCustomFieldDefs, useProjectMutations } from '@/hooks/queries'
import type { ProjectInput } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 新建项目对话框 */
export function ProjectFormDialog({ open, onOpenChange }: Props) {
  const [value, setValue] = useState<ProjectInput>(emptyProjectInput)
  const { create } = useProjectMutations()
  const customDefsQ = useCustomFieldDefs()

  useEffect(() => {
    if (open) setValue(emptyProjectInput())
  }, [open])

  const submit = () => {
    const defs = customDefsQ.data ?? []
    const err = validateProjectInput(value, defs)
    if (err) {
      toast.error(err)
      return
    }
    create.mutate(normalizeForSubmit(value, defs), {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>填写项目基础信息，带 * 为必填项。</DialogDescription>
        </DialogHeader>
        <ProjectFormFields value={value} onChange={setValue} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? '创建中…' : '创建项目'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
