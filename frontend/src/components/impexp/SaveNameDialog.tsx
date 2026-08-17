import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 如「另存为映射方案」 */
  title: string
  description?: string
  /** 名称输入框 label，如「方案名称」 */
  nameLabel: string
  defaultName?: string
  loading?: boolean
  onSubmit: (name: string) => void
}

/** 通用「另存为」命名对话框（导入映射方案 / 导出模板共用） */
export function SaveNameDialog({
  open,
  onOpenChange,
  title,
  description,
  nameLabel,
  defaultName = '',
  loading,
  onSubmit,
}: Props) {
  const [name, setName] = useState(defaultName)
  useEffect(() => {
    if (open) setName(defaultName)
  }, [open, defaultName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>{nameLabel}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入名称"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={loading || !name.trim()} onClick={() => onSubmit(name.trim())}>
            {loading ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
