import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useDictionaries, useDictMutations } from '@/hooks/queries'
import type { DictNode, ID } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'

type DictKind = 'track' | 'industry' | 'solution' | 'safety_space'

const DICT_KINDS: { value: DictKind; label: string; hint: string }[] = [
  { value: 'track', label: '赛道', hint: '项目「赛道」字段的可选值' },
  { value: 'industry', label: '行业', hint: '行业为两级结构：顶级行业下可挂子行业' },
  { value: 'solution', label: '解决方案', hint: '项目「解决方案」字段的可选值' },
  { value: 'safety_space', label: '安全空间', hint: '项目「安全空间」字段的可选值' },
]

interface Row {
  node: DictNode
  depth: number
}

const byOrder = (a: DictNode, b: DictNode) => a.sortOrder - b.sortOrder || a.id - b.id

export function DictManager() {
  const [kind, setKind] = useState<DictKind>('track')
  const { data, isLoading } = useDictionaries(kind)
  const { create, update, remove } = useDictMutations()

  const [newValue, setNewValue] = useState('')
  /** industry 专用：'top' = 顶级行业，否则为父行业 id 字符串 */
  const [parentChoice, setParentChoice] = useState('top')
  const [editing, setEditing] = useState<{ id: ID; value: string } | null>(null)
  const [toDelete, setToDelete] = useState<DictNode | null>(null)

  const rows = useMemo<Row[]>(() => {
    const list = data ?? []
    if (kind !== 'industry') return [...list].sort(byOrder).map((node) => ({ node, depth: 0 }))
    const out: Row[] = []
    for (const ind of [...list].sort(byOrder)) {
      out.push({ node: ind, depth: 0 })
      for (const sub of [...(ind.children ?? [])].sort(byOrder)) out.push({ node: sub, depth: 1 })
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
    if (kind === 'industry' && parentChoice !== 'top') {
      const parentId = Number(parentChoice)
      const parent = (data ?? []).find((n) => n.id === parentId)
      const maxOrder = Math.max(0, ...(parent?.children ?? []).map((n) => n.sortOrder))
      create.mutate({ type: 'sub_industry', value, parentId, sortOrder: maxOrder + 10 })
    } else {
      const maxOrder = Math.max(0, ...(data ?? []).map((n) => n.sortOrder))
      create.mutate({ type: kind, value, parentId: null, sortOrder: maxOrder + 10 })
    }
    setNewValue('')
  }

  const handleMove = (row: Row, dir: -1 | 1) => {
    const siblings = siblingsOf(row)
    const idx = siblings.findIndex((r) => r.node.id === row.node.id)
    const other = siblings[idx + dir]
    if (!other) return
    update.mutate({ id: row.node.id, input: { sortOrder: other.node.sortOrder } })
    update.mutate({ id: other.node.id, input: { sortOrder: row.node.sortOrder } })
  }

  const handleRename = () => {
    if (!editing) return
    const value = editing.value.trim()
    if (!value) return
    update.mutate({ id: editing.id, input: { value } })
    setEditing(null)
  }

  const parentOptions = [
    { value: 'top', label: '顶级行业' },
    ...(data ?? []).map((n) => ({ value: String(n.id), label: `「${n.value}」的子行业` })),
  ]

  return (
    <div className="space-y-4">
      {/* 类型切换 */}
      <div className="flex flex-wrap items-center gap-2">
        {DICT_KINDS.map((k) => (
          <Button
            key={k.value}
            size="sm"
            variant={kind === k.value ? 'default' : 'outline'}
            onClick={() => handleSwitchKind(k.value)}
          >
            {k.label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">
          {DICT_KINDS.find((k) => k.value === kind)?.hint}
        </span>
      </div>

      {/* 新增 */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-64"
          placeholder="名称"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        {kind === 'industry' && (
          <Select
            className="w-48"
            value={parentChoice}
            onValueChange={setParentChoice}
            options={parentOptions}
          />
        )}
        <Button size="sm" onClick={handleAdd} disabled={!newValue.trim() || create.isPending}>
          <Plus className="h-4 w-4" /> 添加
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
                )}
              >
                {row.depth === 1 && <span className="text-muted-foreground/50">└</span>}
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
          remove.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  )
}
