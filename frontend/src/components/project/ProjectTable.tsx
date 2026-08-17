import { useRef, useState, type MouseEvent } from 'react'
import dayjs from 'dayjs'
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, type SelectOption } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { isSortableColumn, type PipelineColumn } from '@/components/project/columns'
import { applyFieldEdit, normalizeForSubmit, projectToInput } from '@/components/project/project-utils'
import { useCustomFieldDefs, useDictionaries, useProjectMutations } from '@/hooks/queries'
import { getProjectFieldValue, industryCascade } from '@/lib/fields'
import { fmtAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ID, Project } from '@/types'

interface Props {
  projects: Project[]
  /** 可见列（已按用户顺序） */
  columns: PipelineColumn[]
  recycleBin: boolean
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  onSort: (key: string) => void
  onOpenDetail: (id: ID) => void
  onRequestDelete: (p: Project) => void
}

interface Editing {
  id: ID
  key: string
  value: string
}

/** 管道表格：双击行内编辑、列头排序、操作列（详情/删除；回收站为恢复+删除时间） */
export function ProjectTable({
  projects,
  columns,
  recycleBin,
  sortBy,
  sortDirection,
  onSort,
  onOpenDetail,
  onRequestDelete,
}: Props) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const clickTimer = useRef<number | null>(null)

  const { update, restore } = useProjectMutations()
  const industryQ = useDictionaries('industry')
  const trackQ = useDictionaries('track')
  const solutionQ = useDictionaries('solution')
  const customDefsQ = useCustomFieldDefs()

  const cascade = industryCascade(industryQ.data ?? [])

  const isEditable = (key: string) => !recycleBin && key !== 'revenueTotal'

  const dictOptionsFor = (key: string, row: Project): SelectOption[] | null => {
    const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }))
    if (key === 'industry') return toOptions(cascade.industries.map((n) => n.value))
    if (key === 'subIndustry') return toOptions((cascade.subMap.get(row.industry) ?? []).map((n) => n.value))
    if (key === 'track') return toOptions((trackQ.data ?? []).map((n) => n.value))
    if (key === 'solution') return toOptions((solutionQ.data ?? []).map((n) => n.value))
    return null
  }

  const commitEdit = (override?: string) => {
    if (!editing) return
    const row = projects.find((p) => p.id === editing.id)
    const value = override ?? editing.value
    setEditing(null)
    if (!row) return
    if (getProjectFieldValue(row, editing.key) === value) return
    const input = applyFieldEdit(projectToInput(row), editing.key, value)
    update.mutate({ id: row.id, input: normalizeForSubmit(input, customDefsQ.data ?? []) })
  }

  const startEdit = (row: Project, key: string) => {
    if (!isEditable(key)) return
    setEditing({ id: row.id, key, value: getProjectFieldValue(row, key) })
  }

  const handleRowClick = (p: Project, e: MouseEvent) => {
    if (editing || e.detail !== 1) return
    if ((e.target as HTMLElement).closest('button,select,input,textarea,a')) return
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(() => onOpenDetail(p.id), 250)
  }

  const handleCellDoubleClick = (p: Project, key: string) => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    startEdit(p, key)
  }

  const renderEditor = (row: Project) => {
    if (!editing) return null
    const dictOptions = dictOptionsFor(editing.key, row)
    if (dictOptions) {
      return (
        <Select
          value={editing.value}
          onValueChange={(v) => commitEdit(v)}
          options={dictOptions}
          clearable
          clearLabel="（清空）"
          autoFocus
        />
      )
    }
    return (
      <Input
        autoFocus
        value={editing.value}
        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit()
          if (e.key === 'Escape') setEditing(null)
        }}
        onBlur={() => commitEdit()}
        className="h-8"
      />
    )
  }

  const renderHead = (col: PipelineColumn) => {
    const sortable = isSortableColumn(col.key)
    const active = sortBy === col.key
    return (
      <TableHead key={col.key} className={cn(col.key === 'revenueTotal' && 'text-right')}>
        {sortable ? (
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
            onClick={() => onSort(col.key)}
          >
            {col.label}
            {active ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
            )}
          </button>
        ) : (
          col.label
        )}
      </TableHead>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map(renderHead)}
          <TableHead className="w-28 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow key={p.id} className="cursor-pointer" onClick={(e) => handleRowClick(p, e)}>
            {columns.map((col) => {
              const isEditing = editing?.id === p.id && editing.key === col.key
              const editable = isEditable(col.key)
              return (
                <TableCell
                  key={col.key}
                  className={cn(
                    'max-w-56 truncate',
                    col.key === 'revenueTotal' && 'text-right tabular-nums',
                    editable && !isEditing && 'cursor-text',
                  )}
                  title={isEditing ? undefined : getProjectFieldValue(p, col.key)}
                  onDoubleClick={editable ? () => handleCellDoubleClick(p, col.key) : undefined}
                >
                  {isEditing
                    ? renderEditor(p)
                    : col.key === 'revenueTotal'
                      ? fmtAmount(p.revenueTotal)
                      : getProjectFieldValue(p, col.key) || <span className="text-muted-foreground/50">-</span>}
                </TableCell>
              )
            })}
            <TableCell className="text-right">
              {recycleBin ? (
                <div className="flex flex-col items-end gap-1">
                  <Button variant="outline" size="xs" onClick={() => restore.mutate(p.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    删除于 {dayjs(p.updatedAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                </div>
              ) : (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="xs" onClick={() => onOpenDetail(p.id)}>
                    <Eye className="h-3.5 w-3.5" />
                    详情
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => onRequestDelete(p)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    删除
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
