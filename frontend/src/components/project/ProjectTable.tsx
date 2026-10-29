import { useRef, useState, type MouseEvent } from 'react'
import dayjs from 'dayjs'
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, RotateCcw, Trash2, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { getProjectFieldValue, industryCascade, solutionCascade } from '@/lib/fields'
import { fmtAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import { actionReminder } from '@/lib/actions'
import { followUpReminder, formatFollowUpTime, PROJECT_LEVELS, type FollowUpPolicy } from '@/lib/followUp'
import type { ID, Project } from '@/types'

interface Props {
  today: string
  followUpPolicy?: FollowUpPolicy
  onCompleteAction: (project: Project) => void
  projects: Project[]
  /** 可见列（已按用户顺序） */
  columns: PipelineColumn[]
  recycleBin: boolean
  selectedIds: ReadonlySet<ID>
  deleting: boolean
  onSelectProject: (project: Project, selected: boolean) => void
  onSelectPage: (selected: boolean) => void
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  onSort: (key: string) => void
  onOpenDetail: (id: ID) => void
  onRequestDelete: (p: Project) => void
  onRequestWin: (p: Project) => void
}

interface Editing {
  id: ID
  key: string
  value: string
}

/** 管道表格：双击行内编辑、勾选及排序；回收站支持恢复和永久删除。 */
export function ProjectTable({
  projects,
  columns,
  recycleBin,
  selectedIds,
  deleting,
  onSelectProject,
  onSelectPage,
  sortBy,
  sortDirection,
  onSort,
  onOpenDetail,
  onRequestDelete,
  onRequestWin,
  today,
  followUpPolicy,
  onCompleteAction,
}: Props) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const clickTimer = useRef<number | null>(null)

  const { update, restore } = useProjectMutations()
  const industryQ = useDictionaries('industry')
  const trackQ = useDictionaries('track')
  const directionQ = useDictionaries('security_direction')
  const solutionQ = useDictionaries('solution')
  const customDefsQ = useCustomFieldDefs()

  const cascade = industryCascade(industryQ.data ?? [])
  const solutions = solutionCascade(solutionQ.data ?? [])

  const isEditable = (key: string) => !recycleBin && !deleting && !['followUpReminder', 'revenueTotal', 'projectStatus', 'purchasedProducts', 'lastFollowUpAt', 'solutions', 'solution', 'subSolution', 'responsibles', 'hcsStatus'].includes(key)

  const dictOptionsFor = (key: string, row: Project): SelectOption[] | null => {
    const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }))
    if (key === 'fixedTarget') return toOptions(['是', '否'])
    if (key === 'projectLevel') return toOptions([...PROJECT_LEVELS])
    if (key === 'industry') return toOptions(cascade.industries.map((n) => n.value))
    if (key === 'subIndustry') return toOptions((cascade.subMap.get(row.industry) ?? []).map((n) => n.value))
    if (key === 'track') return toOptions((trackQ.data ?? []).map((n) => n.value))
    if (key === 'securityDirection') return toOptions((directionQ.data ?? []).map((n) => n.value))
    if (key === 'solution') return toOptions(solutions.solutions.map((n) => n.value))
    if (key === 'subSolution') return toOptions((solutions.subMap.get(row.solution) ?? []).map((n) => n.value))
    if (key.startsWith('custom.')) {
      const def = customDefsQ.data?.find((field) => field.fieldKey === key.slice(7))
      if (def?.fieldType === 'option') return toOptions(def.options)
    }
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
    setEditing({ id: row.id, key, value: key === 'projectLevel' ? row.projectLevel ?? '' : getProjectFieldValue(row, key) })
  }

  const handleRowClick = (p: Project, e: MouseEvent) => {
    if (recycleBin || editing || e.detail !== 1) return
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
          clearable={editing.key !== 'fixedTarget'}
          clearLabel="（清空）"
          autoFocus
        />
      )
    }
    return (
      <Input
        type={editing.key === 'securityBudget' ? 'number' : editing.key === 'nextActionDate' ? 'date' : 'text'}
        min={editing.key === 'securityBudget' ? '0' : undefined}
        step={editing.key === 'securityBudget' ? '0.01' : undefined}
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
      <TableHead
        key={col.key}
        className={cn((col.key === 'revenueTotal' || col.key === 'securityBudget') && 'text-right')}
      >
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
          <TableHead className="w-10">
            <Checkbox aria-label="选择当前页项目" disabled={deleting} checked={projects.every((project) => selectedIds.has(project.id))
              ? true : projects.some((project) => selectedIds.has(project.id)) ? 'indeterminate' : false}
              onCheckedChange={(checked) => onSelectPage(checked === true)} />
          </TableHead>
          {columns.map(renderHead)}
          <TableHead className="w-48 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((p) => {
          const followUp = followUpPolicy ? followUpReminder(p, followUpPolicy, today) : null
          return (
          <TableRow key={p.id} className={cn(!recycleBin && 'cursor-pointer', !recycleBin && (actionReminder(p.nextActionDate, today).group === 0 || followUp?.due) && 'border-l-4 border-l-red-500 bg-red-50/30')} data-state={selectedIds.has(p.id) ? 'selected' : undefined} onClick={(e) => handleRowClick(p, e)}>
            <TableCell onClick={(event) => event.stopPropagation()}>
              <Checkbox aria-label={`选择项目 ${p.customerName} · ${p.projectName}`} disabled={deleting} checked={selectedIds.has(p.id)}
                onCheckedChange={(checked) => onSelectProject(p, checked === true)} />
            </TableCell>
            {columns.map((col) => {
              const isEditing = editing?.id === p.id && editing.key === col.key
              const editable = isEditable(col.key)
              return (
                <TableCell
                  key={col.key}
                  className={cn(
                    'max-w-56 truncate',
                    (col.key === 'revenueTotal' || col.key === 'securityBudget') && 'text-right tabular-nums',
                    editable && !isEditing && 'cursor-text',
                  )}
                  title={isEditing ? undefined : col.key === 'followUpReminder' ? followUp ? `${followUp.label}；${followUp.fieldLabel}：${followUp.matchLabel}，每 ${followUp.interval} 天${followUp.matched ? '' : '（默认周期）'}；应跟进日期 ${followUp.dueDate ?? '待核对'}` : '提醒规则尚未读取' : getProjectFieldValue(p, col.key)}
                  onDoubleClick={editable ? () => handleCellDoubleClick(p, col.key) : undefined}
                >
                  {isEditing
                    ? renderEditor(p)
                    : col.key === 'followUpReminder' ? followUp ? <span className={cn('inline-flex flex-col rounded border px-2 py-1 text-xs', followUp.tone)}><span className="font-medium">{followUp.label}</span><span>{followUp.matchLabel} · 每 {followUp.interval} 天{!followUp.matched && '（默认）'}{followUp.monitored && followUp.days != null ? ` · 已 ${followUp.days} 天未跟进` : ''}</span></span> : <span className="text-xs text-muted-foreground">提醒规则尚未读取</span>
                    : col.key === 'nextActionDate' ? <span className={cn('inline-flex flex-col rounded border border-transparent px-2 py-1 text-xs', actionReminder(p.nextActionDate, today).tone)}><span>{p.nextActionDate}</span><span>{actionReminder(p.nextActionDate, today).label}</span></span>
                    : col.key === 'lastFollowUpAt' ? formatFollowUpTime(p.lastFollowUpAt)
                    : col.key === 'revenueTotal' || col.key === 'securityBudget'
                      ? fmtAmount(col.key === 'revenueTotal' ? p.revenueTotal : p.securityBudget)
                      : getProjectFieldValue(p, col.key) || <span className="text-muted-foreground/50">-</span>}
                </TableCell>
              )
            })}
            <TableCell className="text-right">
              {recycleBin ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-1">
                    <Button variant="outline" size="xs" disabled={deleting || restore.isPending} onClick={() => restore.mutate(p.id, { onSuccess: () => onSelectProject(p, false) })}>
                      <RotateCcw className="h-3.5 w-3.5" />恢复
                    </Button>
                    <Button variant="destructive" size="xs" disabled={deleting || restore.isPending} onClick={() => onRequestDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5" />永久删除
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    删除于 {dayjs(p.updatedAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                </div>
              ) : (
                <div className="flex justify-end gap-1">
                  {p.nextActionDate && <Button variant="outline" size="xs" onClick={() => onCompleteAction(p)}>完成本次行动</Button>}
                  {p.projectStatus === '中标' ? (
                    <Badge variant="success" className="self-center">已中标</Badge>
                  ) : (
                    <Button variant="outline" size="xs" onClick={() => onRequestWin(p)}>
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      中标
                    </Button>
                  )}
                  <Button variant="ghost" size="xs" onClick={() => onOpenDetail(p.id)}>
                    <Eye className="h-3.5 w-3.5" />
                    详情
                  </Button>
                  <Button variant="ghost" size="xs" disabled={deleting} onClick={() => onRequestDelete(p)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    删除
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        )})}
      </TableBody>
    </Table>
  )
}
