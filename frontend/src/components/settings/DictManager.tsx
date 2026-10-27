import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { useDictionaries, useDictMutations, useDictionaryCategories, useDictionaryCategoryMutations } from '@/hooks/queries'
import type { DictNode, ID } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'
import { PRODUCT_CATALOG } from '@/lib/products'
import { dictionaryKinds, dictionaryValueTarget, type DictKind, type DictionaryKind } from './dictKinds'
import { DictionaryImportDialog } from './DictionaryImportDialog'

interface Row {
  node: DictNode
  depth: number
}

const byOrder = (a: DictNode, b: DictNode) => a.sortOrder - b.sortOrder || a.id - b.id

export function DictManager() {
  const [kind, setKind] = useState<DictKind>('track')
  const dictionaryQuery = useDictionaries(kind)
  const { data, isLoading } = dictionaryQuery
  const { create, update, remove } = useDictMutations()
  const categories = useDictionaryCategories()
  const categoryMutations = useDictionaryCategoryMutations()
  const kinds = dictionaryKinds(categories.data)
  const currentKind = kinds.find((item) => item.value === kind)

  const [newValue, setNewValue] = useState('')
  /** 层级字典使用：top 表示顶级，其余表示选定的父节点。 */
  const [parentChoice, setParentChoice] = useState('top')
  const [editing, setEditing] = useState<{ id: ID; value: string } | null>(null)
  const [toDelete, setToDelete] = useState<DictNode | null>(null)
  const [categoryDialog, setCategoryDialog] = useState<{ category: DictionaryKind | null; type: string; label: string } | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<DictionaryKind | null>(null)
  const [importTarget, setImportTarget] = useState<{ type: string; parentId: ID | null; label: string } | null>(null)

  const rows = useMemo<Row[]>(() => {
    const list = data ?? []
    if (kind !== 'industry' && kind !== 'solution') return [...list].sort(byOrder).map((node) => ({ node, depth: 0 }))
    const out: Row[] = []
    for (const root of [...list].sort(byOrder)) {
      out.push({ node: root, depth: 0 })
      for (const child of [...(root.children ?? [])].sort(byOrder)) {
        out.push({ node: child, depth: 1 })
        if (kind === 'solution') {
          for (const product of [...(child.children ?? [])].sort(byOrder)) {
            out.push({ node: product, depth: 2 })
          }
        }
      }
    }
    return out
  }, [data, kind])

  /** 同级（同深度同父）有序列表，用于上移/下移 */
  const siblingsOf = (row: Row) =>
    rows.filter((r) => r.depth === row.depth && r.node.parentId === row.node.parentId)

  const handleSwitchKind = (k: DictKind) => {
    setKind(k)
    setNewValue('')
    setParentChoice('top')
    setEditing(null)
  }

  const handleAdd = () => {
    const value = newValue.trim()
    if (!value) return
    if (parentChoice !== 'top' && !selectedParent) return toast.error('所选上级字典项已不存在，请重新选择')
    const target = dictionaryValueTarget(kind, selectedParent)
    const siblings = selectedParent?.children ?? data ?? []
    const maxOrder = Math.max(0, ...siblings.map((node) => node.sortOrder))
    create.mutate({ ...target, value, sortOrder: maxOrder + 10 }, { onSuccess: () => setNewValue('') })
  }

  const handleSaveCategory = () => {
    if (!categoryDialog) return
    const label = categoryDialog.label.trim()
    if (!label) return toast.error('请填写字典名称')
    if (label.length > 255) return toast.error('字典名称不能超过 255 个字符')
    if (kinds.some((item) => item.value !== categoryDialog.type && item.label.toLowerCase() === label.toLowerCase())) {
      return toast.error('已存在同名字典')
    }
    const existing = categories.data?.find((item) => item.type === categoryDialog.type)
    const input = {
      type: categoryDialog.type,
      label,
      sortOrder: existing?.sortOrder ?? Math.max(0, ...(categories.data ?? []).map((item) => item.sortOrder)) + 10,
    }
    if (categoryDialog.category?.id != null) {
      categoryMutations.update.mutate({ id: categoryDialog.category.id, input }, { onSuccess: () => setCategoryDialog(null) })
    } else {
      categoryMutations.create.mutate(input, { onSuccess: () => { handleSwitchKind(input.type); setCategoryDialog(null) } })
    }
  }

  const handleMove = (row: Row, dir: -1 | 1) => {
    const siblings = siblingsOf(row)
    const idx = siblings.findIndex((r) => r.node.id === row.node.id)
    const other = siblings[idx + dir]
    if (!other) return
    update.mutate({
      id: row.node.id,
      input: { type: row.node.type, value: row.node.value, parentId: row.node.parentId, sortOrder: other.node.sortOrder },
    })
    update.mutate({
      id: other.node.id,
      input: { type: other.node.type, value: other.node.value, parentId: other.node.parentId, sortOrder: row.node.sortOrder },
    })
  }

  const handleRename = () => {
    if (!editing) return
    const value = editing.value.trim()
    if (!value) return
    const row = rows.find((item) => item.node.id === editing.id)
    if (!row) return
    update.mutate({
      id: editing.id,
      input: {
        type: row.node.type,
        value,
        parentId: row.node.parentId,
        sortOrder: row.node.sortOrder,
      },
    }, { onSuccess: () => setEditing(null) })
  }

  const parentOptions = kind === 'solution'
    ? [
        { value: 'top', label: '新增顶级解决方案' },
        ...rows
          .filter((row) => row.node.type === 'solution' || row.node.type === 'sub_solution')
          .map((row) => ({
            value: String(row.node.id),
            label: row.node.type === 'solution'
              ? `在「${row.node.value}」下新增细分解决方案`
              : `「${rows.find((item) => item.node.id === row.node.parentId)?.node.value ?? ''} / ${row.node.value}」下新增产品`,
          })),
      ]
    : [
        { value: 'top', label: '顶级行业' },
        ...(data ?? []).map((n) => ({ value: String(n.id), label: `「${n.value}」的子行业` })),
      ]

  const selectedParent = parentChoice === 'top'
    ? null
    : rows.find((row) => String(row.node.id) === parentChoice)?.node ?? null
  const addingProduct = kind === 'solution' && selectedParent?.type === 'sub_solution'
  const productOptions = PRODUCT_CATALOG
    .filter((product) => !(selectedParent?.children ?? []).some((child) => child.value === product))
    .map((product) => ({ value: product, label: product }))
  const categorySaving = categoryMutations.create.isPending || categoryMutations.update.isPending
  const targetLabel = selectedParent
    ? `${currentKind?.label ?? kind} / ${selectedParent.type === 'sub_solution' ? `${rows.find((row) => row.node.id === selectedParent.parentId)?.node.value ?? ''} / ` : ''}${selectedParent.value}`
    : currentKind?.label ?? kind

  return (
    <div className="space-y-4">
      {/* 类型切换 */}
      <div className="flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <Button
            key={k.value}
            size="sm"
            variant={kind === k.value ? 'default' : 'outline'}
            onClick={() => handleSwitchKind(k.value)}
          >
            {k.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" disabled={categories.isLoading || categories.isError} onClick={() => setCategoryDialog({ category: null, type: `custom_${crypto.randomUUID().replaceAll('-', '')}`, label: '' })}>
          <Plus className="h-4 w-4" /> 新增字典
        </Button>
      </div>
      {categories.isError && <p role="alert" className="text-sm text-destructive">字典分类加载失败。<button type="button" className="ml-1 underline" onClick={() => void categories.refetch()}>重新加载</button></p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{currentKind?.hint}</p>
        {currentKind && !currentKind.builtIn && <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setCategoryDialog({ category: currentKind, type: currentKind.value, label: currentKind.label })}>
            <Pencil className="h-3 w-3" /> 重命名字典
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCategoryToDelete(currentKind)}>
            <Trash2 className="h-3 w-3" /> 删除字典
          </Button>
        </div>}
      </div>

      {/* 新增 */}
      <div className="flex flex-wrap items-center gap-2">
        {addingProduct ? (
          <Select
            className="w-64"
            value={newValue}
            onValueChange={setNewValue}
            options={productOptions}
            placeholder="选择固定产品"
          />
        ) : (
          <Input
            className="w-64"
            placeholder="名称"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        )}
        {(kind === 'industry' || kind === 'solution') && (
          <Select
            className="w-48"
            value={parentChoice}
            onValueChange={(value) => {
              setParentChoice(value)
              setNewValue('')
            }}
            options={parentOptions}
          />
        )}
        <Button size="sm" onClick={handleAdd} disabled={!newValue.trim() || create.isPending || isLoading || dictionaryQuery.isError}>
          <Plus className="h-4 w-4" /> 添加
        </Button>
        <Button size="sm" variant="outline" disabled={isLoading || dictionaryQuery.isError || categories.isLoading || categories.isError || (parentChoice !== 'top' && !selectedParent)} onClick={() => setImportTarget({ ...dictionaryValueTarget(kind, selectedParent), label: targetLabel })}>
          <Upload className="h-4 w-4" /> 导入字典值
        </Button>
        <span className="text-xs text-muted-foreground">同级不允许重名，重名会被拒绝</span>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : dictionaryQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">字典值加载失败。<button type="button" className="ml-1 underline" onClick={() => void dictionaryQuery.refetch()}>重新加载</button></p>
      ) : rows.length === 0 ? (
        <EmptyState title="暂无字典项" description="在上方输入名称后点击「添加」" />
      ) : (
        <div className="rounded-xl border">
          {rows.map((row) => {
            const siblings = siblingsOf(row)
            const idx = siblings.findIndex((r) => r.node.id === row.node.id)
            const isEditing = editing?.id === row.node.id
            return (
              <div
                key={row.node.id}
                className={cn(
                  'flex items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40',
                  row.depth === 1 && 'pl-10',
                  row.depth === 2 && 'pl-16',
                )}
              >
                {row.depth > 0 && <span className="text-muted-foreground/50">└</span>}
                {isEditing ? (
                  <>
                    <Input
                      className="h-8 w-64"
                      value={editing.value}
                      autoFocus
                      onChange={(e) => setEditing({ id: row.node.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename()
                        if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                    <Button size="icon-sm" variant="ghost" onClick={handleRename} title="确认">
                      <Check className="h-4 w-4 text-emerald-600" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditing(null)} title="取消">
                      <X className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      改名会同步引用该值的项目，并记录修改日志
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{row.node.value}</span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="上移"
                      disabled={idx <= 0 || update.isPending}
                      onClick={() => handleMove(row, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="下移"
                      disabled={idx === siblings.length - 1 || update.isPending}
                      onClick={() => handleMove(row, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="重命名"
                      disabled={row.node.type === 'product'}
                      onClick={() => setEditing({ id: row.node.id, value: row.node.value })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="删除"
                      onClick={() => setToDelete(row.node)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={toDelete != null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`删除字典项「${toDelete?.value ?? ''}」`}
        description="删除保护：若该项被项目引用或存在子项，删除请求将被拒绝。确认删除？"
        confirmText="删除"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, { onSuccess: () => {
            if (parentChoice === String(toDelete.id)) setParentChoice('top')
            setToDelete(null)
          } })
        }
      />
      <Dialog open={categoryDialog != null} onOpenChange={(open) => !open && !categorySaving && setCategoryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialog?.category ? '重命名字典' : '新增字典'}</DialogTitle>
            <DialogDescription>创建后可添加、导入字典值，并在自定义选项字段中使用。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dictionary-category-name">字典名称</Label>
            <Input id="dictionary-category-name" autoFocus maxLength={255} placeholder="如：客户级别、所属区域" value={categoryDialog?.label ?? ''}
              onChange={(event) => categoryDialog && setCategoryDialog({ ...categoryDialog, label: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && !categorySaving && handleSaveCategory()} />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={categorySaving} onClick={() => setCategoryDialog(null)}>取消</Button>
            <Button disabled={categorySaving || !categoryDialog?.label.trim()} onClick={handleSaveCategory}>{categorySaving ? '保存中…' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={categoryToDelete != null} onOpenChange={(open) => !open && setCategoryToDelete(null)}
        title={`删除字典「${categoryToDelete?.label ?? ''}」`} description="仅能删除没有字典值、且未被自定义字段引用的字典。确认删除？" confirmText="删除字典" destructive
        loading={categoryMutations.remove.isPending} onConfirm={() => {
          if (categoryToDelete?.id == null) return
          categoryMutations.remove.mutate(categoryToDelete.id, { onSuccess: () => { setCategoryToDelete(null); handleSwitchKind('track') } })
        }} />
      <DictionaryImportDialog open={importTarget != null} onOpenChange={(open) => !open && setImportTarget(null)} target={importTarget} />
    </div>
  )
}
