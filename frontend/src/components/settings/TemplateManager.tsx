import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { Eye, Trash2 } from 'lucide-react'
import { useExportTemplates, useTemplateMutations } from '@/hooks/queries'
import type { ExportScope, ExportTemplate } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info'

const SCOPE_META: Record<ExportScope, { label: string; variant: BadgeVariant }> = {
  combined: { label: '综合表', variant: 'default' },
  projects: { label: '主表', variant: 'info' },
  revenues: { label: '收入明细', variant: 'success' },
  progress: { label: '进展日志', variant: 'warning' },
}

export function TemplateManager() {
  const { data, isLoading } = useExportTemplates()
  const { remove } = useTemplateMutations()

  const [detail, setDetail] = useState<ExportTemplate | null>(null)
  const [toDelete, setToDelete] = useState<ExportTemplate | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          导出模板在导出页配置列后另存，此处仅查看与删除。
        </p>
        <Link to="/export" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          前往导出
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState title="暂无导出模板" description="在导出页选择范围与列后可另存为模板" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>范围</TableHead>
              <TableHead>列数</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-40">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((t) => {
              const meta = SCOPE_META[t.scope]
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant={meta?.variant ?? 'secondary'}>{meta?.label ?? t.scope}</Badge>
                  </TableCell>
                  <TableCell>{t.columns.length}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dayjs(t.updatedAt).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(t)}>
                        <Eye className="h-4 w-4" /> 查看列
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(t)}>
                        <Trash2 className="h-4 w-4 text-destructive" /> 删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* 查看列（有序） */}
      <Dialog open={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>模板列：{detail?.name}</DialogTitle>
            <DialogDescription>列顺序即导出 Excel 的列顺序</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="rounded-lg border text-sm">
              {detail.columns.map((col, i) => (
                <div
                  key={`${col.key}-${i}`}
                  className="flex items-center gap-3 border-b px-3 py-1.5 last:border-b-0"
                >
                  <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{col.title}</span>
                  <span className="text-xs text-muted-foreground/60">{col.key}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete != null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`删除导出模板「${toDelete?.name ?? ''}」`}
        description="删除后不可恢复。确认删除？"
        confirmText="删除"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  )
}
