import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCustomFieldDefs, useCustomFieldMutations } from '@/hooks/queries'
import type { CustomFieldDef, CustomFieldType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info'

const FIELD_TYPE_META: Record<CustomFieldType, { label: string; variant: BadgeVariant }> = {
  text: { label: '文本', variant: 'secondary' },
  number: { label: '数值', variant: 'info' },
  date: { label: '日期', variant: 'warning' },
  option: { label: '选项', variant: 'success' },
}

const FIELD_TYPE_OPTIONS = (Object.keys(FIELD_TYPE_META) as CustomFieldType[]).map((k) => ({
  value: k,
  label: FIELD_TYPE_META[k].label,
}))

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/

interface FormState {
  fieldKey: string
  label: string
  fieldType: CustomFieldType
  required: boolean
  optionsText: string
  sortOrder: string
}

const EMPTY_FORM: FormState = {
  fieldKey: '',
  label: '',
  fieldType: 'text',
  required: false,
  optionsText: '',
  sortOrder: '10',
}

type DialogState = { mode: 'create' } | { mode: 'edit'; def: CustomFieldDef } | null

export function CustomFieldManager() {
  const { data, isLoading } = useCustomFieldDefs()
  const { create, update, remove } = useCustomFieldMutations()

  const [dialog, setDialog] = useState<DialogState>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [toDelete, setToDelete] = useState<CustomFieldDef | null>(null)

  // 打开弹窗时初始化表单
  useEffect(() => {
    if (!dialog) return
    if (dialog.mode === 'edit') {
      const d = dialog.def
      setForm({
        fieldKey: d.fieldKey,
        label: d.label,
        fieldType: d.fieldType,
        required: d.required,
        optionsText: d.options.join(', '),
        sortOrder: String(d.sortOrder),
      })
    } else {
      const maxOrder = Math.max(0, ...(data ?? []).map((d) => d.sortOrder))
      setForm({ ...EMPTY_FORM, sortOrder: String(maxOrder + 10) })
    }
  }, [dialog, data])

  const parseOptions = () =>
    form.optionsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)

  const handleSubmit = () => {
    if (!dialog) return
    const label = form.label.trim()
    const options = parseOptions()
    const sortOrder = Number(form.sortOrder)

    if (!label) return toast.error('请填写字段名称')
    if (dialog.mode === 'create' && !FIELD_KEY_PATTERN.test(form.fieldKey))
      return toast.error('fieldKey 需字母开头，仅含小写字母/数字/下划线')
    if (form.fieldType === 'option' && options.length === 0)
      return toast.error('选项类型需至少填写一个候选项')
    if (Number.isNaN(sortOrder)) return toast.error('排序号需为数字')

    if (dialog.mode === 'create') {
      create.mutate(
        {
          fieldKey: form.fieldKey,
          label,
          fieldType: form.fieldType,
          required: form.required,
          options,
          sortOrder,
        },
        { onSuccess: () => setDialog(null) },
      )
    } else {
      update.mutate(
        {
          id: dialog.def.id,
          input: { label, fieldType: form.fieldType, required: form.required, options, sortOrder },
        },
        { onSuccess: () => setDialog(null) },
      )
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          字段定义后自动出现在：详情表单、列表可选列、导入映射目标、导出可选列。删除字段不会删除项目里已存的值，只是不再展示。
        </p>
        <Button size="sm" onClick={() => setDialog({ mode: 'create' })}>
          <Plus className="h-4 w-4" /> 新增字段
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState title="暂无自定义字段" description="点击右上角「新增字段」创建" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>fieldKey</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>必填</TableHead>
              <TableHead>选项</TableHead>
              <TableHead>排序</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...data]
              .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
              .map((d) => {
                const meta = FIELD_TYPE_META[d.fieldType]
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.label}</TableCell>
                    <TableCell className="text-muted-foreground">{d.fieldKey}</TableCell>
                    <TableCell>
                      <Badge variant={meta?.variant ?? 'secondary'}>{meta?.label ?? d.fieldType}</Badge>
                    </TableCell>
                    <TableCell>{d.required ? '是' : '否'}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {d.fieldType === 'option' ? d.options.join('、') : '—'}
                    </TableCell>
                    <TableCell>{d.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="编辑"
                          onClick={() => setDialog({ mode: 'edit', def: d })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="删除"
                          onClick={() => setToDelete(d)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      )}

      {/* 新增 / 编辑 */}
      <Dialog open={dialog != null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === 'edit' ? '编辑字段' : '新增字段'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label>fieldKey</Label>
              <Input
                value={form.fieldKey}
                disabled={dialog?.mode === 'edit'}
                placeholder="如 partner_level"
                onChange={(e) => setForm({ ...form, fieldKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                小写字母/数字/下划线、字母开头，创建后不可改
              </p>
            </div>
            <div className="space-y-1">
              <Label>字段名称</Label>
              <Input
                value={form.label}
                placeholder="展示用中文名"
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>类型</Label>
                <Select
                  value={form.fieldType}
                  onValueChange={(v) => setForm({ ...form, fieldType: v as CustomFieldType })}
                  options={FIELD_TYPE_OPTIONS}
                />
              </div>
              <div className="space-y-1">
                <Label>排序号</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
            </div>
            {form.fieldType === 'option' && (
              <div className="space-y-1">
                <Label>候选项</Label>
                <Input
                  value={form.optionsText}
                  placeholder="逗号分隔，如：高, 中, 低"
                  onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                />
              </div>
            )}
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.required}
                onCheckedChange={(v) => setForm({ ...form, required: v === true })}
              />
              <span>必填</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete != null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`删除字段「${toDelete?.label ?? ''}」`}
        description="被项目数据引用时不可删除，删除请求会被拒绝。删除字段不会删除项目里已存的值，只是不再展示。确认删除？"
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
