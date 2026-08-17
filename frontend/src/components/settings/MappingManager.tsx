import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { Eye, Trash2 } from 'lucide-react'
import { useCustomFieldDefs, useImportMappings, useMappingMutations } from '@/hooks/queries'
import type { CustomFieldDef, ImportMapping, ValueRule } from '@/types'
import { PROJECT_FIELD_LABELS } from '@/lib/fields'
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

/** 目标字段 key → 中文名（含 progressText / revenue:YYYY-MM / custom.xxx 伪字段） */
function targetLabel(target: string, customs: CustomFieldDef[]): string {
  if (target.startsWith('revenue:')) return `收入(${target.slice('revenue:'.length)})`
  if (target.startsWith('custom.')) {
    const key = target.slice('custom.'.length)
    const def = customs.find((c) => c.fieldKey === key)
    return def ? `自定义字段「${def.label}」` : `自定义字段(${key})`
  }
  return PROJECT_FIELD_LABELS[target] ?? target
}

function ruleSummary(rule: ValueRule, customs: CustomFieldDef[]): string {
  switch (rule.type) {
    case 'exact':
      return `精确对照：列「${rule.source}」${Object.keys(rule.mapping).length} 条对照`
    case 'split':
      return `拆分：列「${rule.source}」按 '${rule.delimiter}' → ${rule.targets
        .map((t) => targetLabel(t, customs))
        .join(', ')}`
    case 'default':
      return `默认值：${targetLabel(rule.field, customs)} = ${rule.value}`
  }
}

export function MappingManager() {
  const { data, isLoading } = useImportMappings()
  const { data: customs } = useCustomFieldDefs()
  const { remove } = useMappingMutations()

  const [detail, setDetail] = useState<ImportMapping | null>(null)
  const [toDelete, setToDelete] = useState<ImportMapping | null>(null)

  const customDefs = customs ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          映射方案在导入向导第 2 步创建与另存，此处仅查看与删除。
        </p>
        <Link to="/import" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          前往导入向导
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState title="暂无映射方案" description="在导入向导第 2 步配置列映射后可另存为方案" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>列映射数</TableHead>
              <TableHead>值规则数</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="w-40">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{Object.keys(m.columnMap).length}</TableCell>
                <TableCell>{m.valueRules.length}</TableCell>
                <TableCell className="text-muted-foreground">
                  {dayjs(m.updatedAt).format('YYYY-MM-DD HH:mm')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(m)}>
                      <Eye className="h-4 w-4" /> 查看详情
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(m)}>
                      <Trash2 className="h-4 w-4 text-destructive" /> 删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 只读详情 */}
      <Dialog open={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>映射方案：{detail?.name}</DialogTitle>
            <DialogDescription>只读预览，编辑请在导入向导中进行</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="mb-1 font-medium">列映射（{Object.keys(detail.columnMap).length}）</div>
                <div className="rounded-lg border">
                  {Object.entries(detail.columnMap).map(([source, target]) => (
                    <div
                      key={source}
                      className="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0"
                    >
                      <span className="w-48 truncate text-muted-foreground">{source}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{targetLabel(target, customDefs)}</span>
                      <span className="ml-auto text-xs text-muted-foreground/60">{target}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 font-medium">值规则（{detail.valueRules.length}）</div>
                {detail.valueRules.length === 0 ? (
                  <div className="text-muted-foreground">无</div>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {detail.valueRules.map((r, i) => (
                      <li key={i}>{ruleSummary(r, customDefs)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete != null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`删除映射方案「${toDelete?.name ?? ''}」`}
        description="删除后不可恢复，已导入的数据不受影响。确认删除？"
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
