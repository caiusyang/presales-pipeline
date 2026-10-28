import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCustomFieldDefs, useCustomFieldMutations, useDictionaries, useDictionaryCategories } from '@/hooks/queries'
import type { CustomFieldDef, CustomFieldType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  optionSource: 'manual' | 'dictionary'
  dictionaryType: string | null
  sortOrder: string
  applicableTracks: string[]
}

const EMPTY_FORM: FormState = {
  fieldKey: '',
  label: '',
  fieldType: 'text',
  required: false,
  optionsText: '',
  optionSource: 'manual',
  dictionaryType: null,
  sortOrder: '10',
  applicableTracks: [],
}

type DialogState = { mode: 'create' } | { mode: 'edit'; def: CustomFieldDef } | null

export function CustomFieldManager() {
  const { data, isLoading } = useCustomFieldDefs()
  const { create, update, remove } = useCustomFieldMutations()
  const categories = useDictionaryCategories()
  const dictionaryValues = useDictionaries()
  const customCategories = (categories.data ?? []).filter((category) => !category.builtIn)

  const [dialog, setDialog] = useState<DialogState>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [toDelete, setToDelete] = useState<CustomFieldDef | null>(null)

  // 仅在打开时初始化，字典刷新不覆盖正在填写的字段配置。
  const openDialog = (next: Exclude<DialogState, null>) => {
    if (next.mode === 'edit') {
      const def = next.def
      setForm({
        fieldKey: def.fieldKey,
        label: def.label,
        fieldType: def.fieldType,
        required: def.required,
        optionsText: def.options.join(', '),
        optionSource: def.dictionaryType ? 'dictionary' : 'manual',
        dictionaryType: def.dictionaryType ?? null,
        sortOrder: String(def.sortOrder),
        applicableTracks: def.applicableTracks ?? [],
      })
    } else {
      const maxOrder = Math.max(0, ...(data ?? []).map((d) => d.sortOrder))
      setForm({ ...EMPTY_FORM, sortOrder: String(maxOrder + 10) })
    }
    setDialog(next)
  }

  const linkedValueCount = (dictionaryValues.data ?? []).filter((item) => item.type === form.dictionaryType).length
  const requiredDictionaryError = form.fieldType === 'option' && form.optionSource === 'dictionary' && form.dictionaryType && form.required
    ? dictionaryValues.isFetching ? '正在校验字典值，请稍候'
      : dictionaryValues.isError ? '字典值加载失败，请重新加载后保存必填字段'
      : linkedValueCount === 0 ? '必填选项字段的字典不能为空，请先到字典管理添加或导入字典值'
      : null
    : null

  const parseOptions = () =>
    form.optionsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)

  const handleSubmit = () => {
    if (!dialog) return
    const label = form.label.trim()
    const dictionaryType = form.fieldType === 'option' && form.optionSource === 'dictionary' ? form.dictionaryType : null
    const options = form.fieldType === 'option' && !dictionaryType ? parseOptions() : []
    const sortOrder = Number(form.sortOrder)

    if (!label) return toast.error('请填写字段名称')
    if (dialog.mode === 'create' && !FIELD_KEY_PATTERN.test(form.fieldKey))
      return toast.error('fieldKey 需字母开头，仅含小写字母/数字/下划线')
    if (form.fieldType === 'option' && form.optionSource === 'dictionary' && !dictionaryType)
      return toast.error('请选择一个自定义字典')
    if (dictionaryType && !customCategories.some((category) => category.type === dictionaryType))
      return toast.error('所选字典不可用，请重新选择或重新加载字典')
    if (requiredDictionaryError) return toast.error(requiredDictionaryError)
    if (form.fieldType === 'option' && form.optionSource === 'manual' && options.length === 0)
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
          dictionaryType,
          sortOrder,
          applicableTracks: form.applicableTracks,
        },
        { onSuccess: () => setDialog(null) },
      )
    } else {
      update.mutate(
        {
          id: dialog.def.id,
          input: {
            fieldKey: dialog.def.fieldKey,
            label,
            fieldType: form.fieldType,
            required: form.required,
            options,
            dictionaryType,
            sortOrder,
            applicableTracks: form.applicableTracks,
          },
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
        <Button size="sm" onClick={() => openDialog({ mode: 'create' })}>
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
              <TableHead>适用赛道</TableHead>
              <TableHead>选项来源 / 候选项</TableHead>
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
                    <TableCell>{d.applicableTracks?.length ? d.applicableTracks.join('、') : '公共字段'}</TableCell>
                    <TableCell className="max-w-64 text-muted-foreground">
                      {d.fieldType === 'option' ? <>
                        <p className="truncate text-xs">{d.dictionaryType
                          ? `字典：${customCategories.find((category) => category.type === d.dictionaryType)?.label ?? '加载中'}`
                          : '手填候选项'}</p>
                        <p className="truncate" title={d.options.join('、')}>{d.options.join('、') || '暂无字典值'}</p>
                      </> : '—'}
                    </TableCell>
                    <TableCell>{d.sortOrder}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="编辑"
                          onClick={() => openDialog({ mode: 'edit', def: d })}
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
            <DialogDescription>选项字段可填写候选项，或关联自定义字典统一维护。</DialogDescription>
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
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="custom-option-source">选项来源</Label>
                  <Select id="custom-option-source" value={form.optionSource}
                    onValueChange={(value) => setForm({ ...form, optionSource: value as FormState['optionSource'] })}
                    options={[{ value: 'manual', label: '手填候选项' }, { value: 'dictionary', label: '使用自定义字典' }]} />
                </div>
                {form.optionSource === 'manual' ? <div className="space-y-1">
                  <Label htmlFor="custom-field-options">候选项</Label>
                  <Input id="custom-field-options" value={form.optionsText} placeholder="逗号分隔，如：高, 中, 低"
                    onChange={(e) => setForm({ ...form, optionsText: e.target.value })} />
                </div> : <div className="space-y-1">
                  <Label htmlFor="custom-field-dictionary">自定义字典</Label>
                  <Select id="custom-field-dictionary" value={form.dictionaryType ?? ''}
                    onValueChange={(value) => setForm({ ...form, dictionaryType: value || null })}
                    options={customCategories.map((category) => ({ value: category.type, label: category.label }))}
                    disabled={categories.isLoading || categories.isError}
                    placeholder={categories.isLoading ? '字典加载中…' : '请选择字典'} />
                  {categories.isError ? <p className="text-xs text-destructive">字典加载失败。<button type="button" className="underline" onClick={() => void categories.refetch()}>重新加载</button></p>
                    : !categories.isLoading && !customCategories.length ? <p className="text-xs text-muted-foreground">请先在「字典管理」中新增字典并添加或导入字典值。</p>
                    : <p className="text-xs text-muted-foreground">候选项随字典更新。项目表单、列表编辑和导入预检共用这些标准值。</p>}
                  {form.dictionaryType && (dictionaryValues.isError
                    ? <p className="text-xs text-destructive">字典值加载失败。<button type="button" className="underline" onClick={() => void dictionaryValues.refetch()}>重新加载字典值</button></p>
                    : dictionaryValues.isFetching ? <p className="text-xs text-muted-foreground">正在加载字典值…</p>
                    : <p className="text-xs text-muted-foreground">当前有 {linkedValueCount} 个字典值。选填字段可先绑定空字典，必填字段需先添加或导入字典值。</p>)}
                  {requiredDictionaryError && !dictionaryValues.isFetching && !dictionaryValues.isError && <p role="alert" className="text-xs text-destructive">{requiredDictionaryError}</p>}
                </div>}
              </div>
            )}
            <label className="flex items-center gap-2">
              <Checkbox
                checked={form.required}
                onCheckedChange={(v) => setForm({ ...form, required: v === true })}
              />
              <span>必填</span>
            </label>
            <fieldset className="space-y-2"><legend>适用赛道</legend>
              <p className="text-xs text-muted-foreground">不勾选时为公共字段。切换赛道不删除已有值，专有必填校验仅在对应赛道生效。</p>
              <div className="flex gap-4">{['HCS', '公有云'].map((track) => <label key={track} className="flex items-center gap-2"><Checkbox checked={form.applicableTracks.includes(track)} onCheckedChange={(checked) => setForm({ ...form, applicableTracks: checked ? [...form.applicableTracks, track] : form.applicableTracks.filter((v) => v !== track) })} />{track}</label>)}</div>
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={pending || Boolean(requiredDictionaryError && dictionaryValues.isFetching)}>
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
