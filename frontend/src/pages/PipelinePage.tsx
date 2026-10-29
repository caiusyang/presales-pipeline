import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Plus, Search, Trash2, Upload } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  buildAvailableColumns,
  loadColumnStates,
  saveColumnStates,
  type ColumnState,
} from '@/components/project/columns'
import { ColumnConfigMenu } from '@/components/project/ColumnConfigMenu'
import { ProjectDetailDrawer } from '@/components/project/ProjectDetailDrawer'
import { ProjectFormDialog } from '@/components/project/ProjectFormDialog'
import { ProjectTable } from '@/components/project/ProjectTable'
import { WinProjectDialog } from '@/components/project/WinProjectDialog'
import { CompleteActionDialog } from '@/components/project/CompleteActionDialog'
import { useBusinessDate } from '@/hooks/useBusinessDate'
import { useCustomFieldDefs, useDictionaries, useProjectMutations, useProjects, usePeople, useFollowUpPolicy } from '@/hooks/queries'
import { PROJECT_LEVELS, normalizeFollowUpPolicy } from '@/lib/followUp'
import { industryCascade, solutionCascade } from '@/lib/fields'
import { cn } from '@/lib/utils'
import type { ProjectListQuery } from '@/api/types'
import { PROJECT_STATUSES, type ID, type Project } from '@/types'

export default function PipelinePage() {
  const [searchParams] = useSearchParams()
  const [solution, setSolution] = useState(searchParams.get('solution') ?? '')
  const [subSolution, setSubSolution] = useState(searchParams.get('subSolution') ?? '')
  const [responsibleId, setResponsibleId] = useState(''), [hcsStatus, setHcsStatus] = useState('')
  const peopleQ = usePeople()
  // ---------- 筛选状态 ----------
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [industry, setIndustry] = useState('')
  const [track, setTrack] = useState('')
  const [projectStatus, setProjectStatus] = useState('')
  const [fixedTarget, setFixedTarget] = useState(''), [projectLevel, setProjectLevel] = useState('')
  const [followUpDue, setFollowUpDue] = useState(false)
  const followUpPolicyQ = useFollowUpPolicy()
  const followUpPolicy = followUpPolicyQ.data ? normalizeFollowUpPolicy(followUpPolicyQ.data) : null
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [recycleBin, setRecycleBin] = useState(false)
  const [actionRange, setActionRange] = useState<ProjectListQuery['actionRange']>()
  const [actionTarget, setActionTarget] = useState<Project | null>(null)
  const today = useBusinessDate()

  // ---------- 分页 / 排序 ----------
  const [page, setPage] = useState(0) // 0 基，与后端一致
  const [size, setSize] = useState(20)
  const [sort, setSort] = useState<{ sortBy?: string; sortDirection?: 'asc' | 'desc' }>({})

  // ---------- 弹层状态 ----------
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<ID | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [winTarget, setWinTarget] = useState<Project | null>(null)
  const [selectedProjects, setSelectedProjects] = useState<Map<ID, Project>>(new Map())
  const [batchTargets, setBatchTargets] = useState<Project[]>([])
  const [deleteFailures, setDeleteFailures] = useState<{ project: Project; message: string }[]>([])

  // 关键字防抖 300ms
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => window.clearTimeout(t)
  }, [keyword])

  // 筛选/回收站/每页条数变化回到第 1 页
  useEffect(() => {
    setPage(0)
  }, [debouncedKeyword, industry, track, projectStatus, startMonth, endMonth, recycleBin, size, actionRange, solution, subSolution, responsibleId, hcsStatus, fixedTarget, projectLevel, followUpDue])

  // 分页及排序保留选择；改变筛选范围时清空，避免删除隐藏在旧筛选中的项目。
  useEffect(() => {
    setSelectedProjects(new Map())
    setDeleteFailures([])
  }, [keyword, industry, track, projectStatus, startMonth, endMonth, recycleBin, size, actionRange, solution, subSolution, responsibleId, hcsStatus, fixedTarget, projectLevel, followUpDue])

  useEffect(() => { if (recycleBin) setFollowUpDue(false) }, [recycleBin])

  // ---------- 数据 ----------
  const query: ProjectListQuery = {
    page,
    size,
    ...(actionRange ? { actionRange } : {}),
    ...(solution ? { solution } : {}), ...(subSolution ? { subSolution } : {}),
    ...(responsibleId ? { responsibleId: Number(responsibleId) } : {}), ...(hcsStatus ? { hcsStatus } : {}),
    ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
    ...(industry ? { industry } : {}),
    ...(track ? { track } : {}),
    ...(projectStatus ? { projectStatus } : {}),
    ...(fixedTarget ? { fixedTarget: fixedTarget === 'true' } : {}),
    ...(projectLevel ? { projectLevel } : {}),
    ...(followUpDue && !recycleBin ? { followUpRange: 'due' as const } : {}),
    ...(startMonth ? { startMonth } : {}),
    ...(endMonth ? { endMonth } : {}),
    ...(recycleBin ? { deleted: true } : {}),
    ...(sort.sortBy ? { sortBy: sort.sortBy, sortDirection: sort.sortDirection ?? 'asc' } : {}),
  }
  const projectsQ = useProjects(query)
  const followUpCountQ = useProjects({ ...query, page: 0, size: 1, deleted: false, followUpRange: 'due' }, !recycleBin && !!followUpPolicyQ.data)
  const industryQ = useDictionaries('industry')
  const trackQ = useDictionaries('track')
  const solutionQ = useDictionaries('solution')
  const solutionTree = solutionCascade(solutionQ.data ?? [])
  const customDefsQ = useCustomFieldDefs()
  const { remove, removeMany, purge, purgeMany, restoreMany } = useProjectMutations()

  const total = projectsQ.data?.total ?? 0
  const items = projectsQ.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil(total / size))
  const deleting = remove.isPending || removeMany.isPending || purge.isPending || purgeMany.isPending || restoreMany.isPending
  const batchPermanent = batchTargets[0]?.deleted === true
  const selectedIds = useMemo(() => new Set(selectedProjects.keys()), [selectedProjects])

  useEffect(() => {
    if (projectsQ.data && !projectsQ.isFetching && page >= totalPages) setPage(totalPages - 1)
  }, [projectsQ.data, projectsQ.isFetching, page, totalPages])

  const selectProjects = (projects: Project[], selected: boolean) => {
    setSelectedProjects((current) => {
      const next = new Map(current)
      projects.forEach((project) => { if (selected) next.set(project.id, project); else next.delete(project.id) })
      return next
    })
  }

  const deleteSelected = async () => {
    if (!batchTargets.length || deleting) return
    const targets = [...batchTargets]
    const mutation = targets[0].deleted ? purgeMany : removeMany
    const result = await mutation.mutateAsync(targets.map((project) => project.id))
    setSelectedProjects((current) => {
      const next = new Map(current)
      result.deletedIds.forEach((id) => next.delete(id))
      return next
    })
    setDeleteFailures(result.failures.map((failure) => ({ project: targets.find((project) => project.id === failure.id)!, message: failure.message })))
    setBatchTargets([])
  }

  // ---------- 列配置 ----------
  const availableColumns = useMemo(
    () => buildAvailableColumns((customDefsQ.data ?? []).filter((def) => !track || track === '__unclassified__' || !def.applicableTracks?.length || def.applicableTracks.includes(track))),
    [customDefsQ.data, track],
  )
  const [columnsByTrack, setColumnsByTrack] = useState<Record<string, ColumnState[]>>({})
  const columnStates = columnsByTrack[track] ?? null
  const setColumnStates = (states: ColumnState[]) => setColumnsByTrack((previous) => ({ ...previous, [track]: states }))
  // 与可用列对齐：剔除已删除的列、追加新增列（自定义字段增删时自动生效）
  const effectiveStates = useMemo(() => {
    const base = columnStates ?? loadColumnStates(availableColumns, track)
    const keys = new Set(availableColumns.map((c) => c.key))
    const merged = base.filter((s) => keys.has(s.key))
    const present = new Set(merged.map((s) => s.key))
    for (const c of availableColumns) {
      if (!present.has(c.key)) merged.push({ key: c.key, visible: c.defaultVisible })
    }
    return merged
  }, [availableColumns, columnStates, track])

  const updateColumns = (states: ColumnState[]) => {
    setColumnStates(states)
    saveColumnStates(states, track)
  }
  const visibleColumns = effectiveStates
    .filter((s) => s.visible)
    .map((s) => availableColumns.find((c) => c.key === s.key))
    .filter((c): c is NonNullable<typeof c> => c != null)

  // ---------- 交互 ----------
  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev.sortBy !== key) return { sortBy: key, sortDirection: 'asc' }
      if (prev.sortDirection === 'asc') return { sortBy: key, sortDirection: 'desc' }
      return {}
    })
  }

  const openDetail = (id: ID) => {
    setDetailId(id)
    setDrawerOpen(true)
  }

  const industryOptions = industryCascade(industryQ.data ?? []).industries.map((n) => ({
    value: n.value,
    label: n.value,
  }))
  const trackOptions = (trackQ.data ?? []).map((n) => ({ value: n.value, label: n.value }))

  return (
    <div className="space-y-4 p-6">
      {/* ---------- 工具栏 ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-40" aria-label="是否固定靶筛选" value={fixedTarget} onValueChange={setFixedTarget} options={[{ value: 'true', label: '固定靶' }, { value: 'false', label: '非固定靶' }]} placeholder="是否固定靶" clearable clearLabel="全部固定靶类型" />
        <Select className="w-40" aria-label="项目级别筛选" value={projectLevel} onValueChange={setProjectLevel} options={PROJECT_LEVELS.map((level) => ({ value: level, label: level }))} placeholder="项目级别" clearable clearLabel="全部项目级别" />
        <Select className="w-44" value={solution} onValueChange={(v) => { setSolution(v); setSubSolution('') }} options={solutionTree.solutions.map((s) => ({ value: s.value, label: s.value }))} placeholder="解决方案" clearable clearLabel="全部方案" />
        <Select className="w-44" value={subSolution} onValueChange={setSubSolution} options={(solutionTree.subMap.get(solution) ?? []).map((s) => ({ value: s.value, label: s.value }))} disabled={!solution} placeholder="细分解决方案" clearable clearLabel="全部细分方案" />
        <Select className="w-44" value={responsibleId} onValueChange={setResponsibleId} options={(peopleQ.data ?? []).map((p) => ({ value: String(p.id), label: `${p.name}${p.employeeNo ? ` · ${p.employeeNo}` : ''}` }))} placeholder="责任人" clearable clearLabel="全部责任人" />
        <Input className="w-40" aria-label="HCS状态筛选" placeholder="筛选 HCS 状态" value={hcsStatus} onChange={(e) => setHcsStatus(e.target.value)} />
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索客户 / 项目 / 外部编号"
            className="pl-8"
          />
        </div>
        <Select
          className="w-40"
          value={industry}
          onValueChange={setIndustry}
          options={industryOptions}
          placeholder="行业"
          clearable
          clearLabel="全部行业"
        />
        <Select
          className="w-40"
          value={track}
          onValueChange={setTrack}
          options={[...trackOptions, { value: '__unclassified__', label: '待分类' }]}
          placeholder="赛道"
          clearable
          clearLabel="全部赛道"
        />
        <Select
          className="w-40"
          value={projectStatus}
          onValueChange={setProjectStatus}
          options={PROJECT_STATUSES.map((status) => ({ value: status, label: status }))}
          placeholder="项目状态"
          clearable
          clearLabel="全部状态"
        />
        <div className="flex items-center gap-1">
          <Input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="w-36"
            aria-label="收入起始月份"
          />
          <span className="text-muted-foreground">~</span>
          <Input
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="w-36"
            aria-label="收入结束月份"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={recycleBin ? 'secondary' : 'outline'}
            onClick={() => setRecycleBin((v) => !v)}
          >
            <Trash2 className="h-4 w-4" />
            回收站
          </Button>
          <ColumnConfigMenu columns={availableColumns} states={effectiveStates} onChange={updateColumns} />
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            新建项目
          </Button>
          <Link to="/import" className={cn(buttonVariants({ variant: 'outline' }))}>
            <Upload className="h-4 w-4" />
            导入
          </Link>
          <Link to="/export" className={cn(buttonVariants({ variant: 'outline' }))}>
            <Download className="h-4 w-4" />
            导出
          </Link>
        </div>
      </div>

      {recycleBin && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          当前查看回收站：可恢复项目，也可永久删除。永久删除会清除项目及其收入明细、进展日志、已购产品记录和修改日志，无法在回收站恢复。
        </div>
      )}

      {!recycleBin && <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        {followUpPolicyQ.isError ? <span role="alert">跟进提醒规则读取失败，暂不计算提醒。<Button variant="link" size="sm" onClick={() => void followUpPolicyQ.refetch()}>重试</Button></span> : followUpPolicyQ.data ? <>
          <span>跟进提醒：按「{followUpPolicy?.fieldLabel ?? followUpPolicy?.fieldKey}」关联 · {followUpPolicy?.rules.length} 条值规则 · 默认 {followUpPolicy?.defaultDays} 天</span>
          <Button size="sm" variant={followUpDue ? 'default' : 'outline'} onClick={() => setFollowUpDue((value) => !value)} aria-pressed={followUpDue}>只看需跟进{followUpCountQ.isError ? '（计数失败）' : followUpCountQ.isFetching ? '（统计中…）' : `（${followUpCountQ.data?.total ?? 0}）`}</Button>
          <span className="text-xs text-muted-foreground">统计当前筛选范围的全部分页，仅提醒未中标的活动项目。</span>
        </> : <span>正在读取跟进提醒规则…</span>}
        <Link to="/settings?tab=follow-up" className="ml-auto text-xs underline underline-offset-4">调整跟进周期</Link>
      </div>}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground">行动提醒（上海日期 {today}）</span>
        {[['', '全部'], ['overdue', '逾期'], ['today', '今天'], ['next7', '未来 7 天'], ['unscheduled', '未安排']].map(([value, label]) => <Button key={value} size="sm" variant={(actionRange ?? '') === value ? 'default' : 'outline'} onClick={() => setActionRange((value || undefined) as ProjectListQuery['actionRange'])}>{label}</Button>)}
        <Button size="sm" variant="ghost" onClick={() => setSort({})}>恢复行动优先排序</Button>
      </div>
      <CompleteActionDialog project={actionTarget} onClose={() => setActionTarget(null)} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span aria-live="polite">已选 {selectedProjects.size} 个项目</span>
        {recycleBin && <Button variant="outline" disabled={!selectedProjects.size || deleting} onClick={() => void restoreMany.mutateAsync([...selectedProjects.keys()]).then((result) => { setSelectedProjects((current) => new Map([...current].filter(([id]) => !result.deletedIds.includes(id)))) }).catch(() => {})}>批量恢复 {selectedProjects.size} 个项目</Button>}
        <Button variant="destructive" disabled={!selectedProjects.size || deleting} onClick={() => setBatchTargets([...selectedProjects.values()])}>
          <Trash2 className="h-4 w-4" />{removeMany.isPending || purgeMany.isPending ? '删除中…' : `${recycleBin ? '批量永久删除' : '批量删除'} ${selectedProjects.size} 个项目`}
        </Button>
        {selectedProjects.size > 0 && <Button variant="ghost" disabled={deleting} onClick={() => setSelectedProjects(new Map())}>清空选择</Button>}
        <span className="text-xs text-muted-foreground">支持跨页勾选，表头全选当前页；{recycleBin ? '永久删除后不可恢复。' : '删除后可在回收站恢复。'}</span>
      </div>
      {deleteFailures.length > 0 && <div role="alert" className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p>以下项目未完成删除，请核对后重试：</p>
        {deleteFailures.map(({ project, message }) => <p key={project.id} className="text-xs text-destructive">{project.customerName} · {project.projectName}：{message}</p>)}
      </div>}

      {/* ---------- 表格 ---------- */}
      <div className="rounded-md border">
        {projectsQ.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={recycleBin ? '回收站为空' : '暂无项目'}
            description={recycleBin ? undefined : '点击右上角「新建项目」或「导入」开始'}
          />
        ) : (
          <ProjectTable
            projects={items}
            today={today}
            followUpPolicy={followUpPolicyQ.isError ? undefined : followUpPolicyQ.data}
            onCompleteAction={setActionTarget}
            columns={visibleColumns}
            recycleBin={recycleBin}
            selectedIds={selectedIds}
            deleting={deleting || projectsQ.isFetching || keyword !== debouncedKeyword}
            onSelectProject={(project, selected) => selectProjects([project], selected)}
            onSelectPage={(selected) => selectProjects(items, selected)}
            sortBy={sort.sortBy}
            sortDirection={sort.sortDirection}
            onSort={toggleSort}
            onOpenDetail={openDetail}
            onRequestDelete={setDeleteTarget}
            onRequestWin={setWinTarget}
          />
        )}
      </div>

      {/* ---------- 分页 ---------- */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>共 {total} 个项目</span>
        <Select
          className="w-24"
          value={String(size)}
          onValueChange={(v) => setSize(Number(v))}
          options={[
            { value: '20', label: '20 / 页' },
            { value: '50', label: '50 / 页' },
            { value: '100', label: '100 / 页' },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span>
            第 {page + 1} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      {/* ---------- 弹层 ---------- */}
      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ProjectDetailDrawer projectId={detailId} open={drawerOpen} onOpenChange={setDrawerOpen} />
      <WinProjectDialog
        project={winTarget}
        open={winTarget != null}
        onOpenChange={(open) => !open && setWinTarget(null)}
      />
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.deleted ? '永久删除项目' : '删除项目'}
        description={
          deleteTarget
            ? deleteTarget.deleted
              ? `确定永久删除「${deleteTarget.customerName} · ${deleteTarget.projectName}」吗？项目及其收入明细、进展日志、已购产品记录和修改日志会彻底删除，此操作不可恢复。`
              : `确定删除「${deleteTarget.customerName} · ${deleteTarget.projectName}」吗？删除为软删除，可在回收站中恢复。`
            : undefined
        }
        confirmText={deleteTarget?.deleted ? '永久删除' : '删除'}
        destructive
        loading={remove.isPending || purge.isPending}
        onConfirm={() => {
          const target = deleteTarget
          if (!target || deleting) return
          const mutation = target.deleted ? purge : remove
          mutation.mutate(target.id, { onSuccess: () => {
            selectProjects([target], false)
            setDeleteFailures((current) => current.filter((failure) => failure.project.id !== target.id))
            setDeleteTarget(null)
          } })
        }}
      />
      <ConfirmDialog
        open={batchTargets.length > 0}
        onOpenChange={(open) => !open && setBatchTargets([])}
        title={batchPermanent ? '批量永久删除项目' : '批量删除项目'}
        description={`确定${batchPermanent ? '永久删除所选' : '将所选'} ${batchTargets.length} 个项目${batchPermanent ? '吗' : '移入回收站吗'}？${batchTargets.slice(0, 5).map((project) => `「${project.customerName} · ${project.projectName}」`).join('、')}${batchTargets.length > 5 ? '等项目' : ''}。${batchPermanent ? '项目及其收入明细、进展日志、已购产品记录和修改日志会彻底删除，此操作不可恢复。' : '删除后可在回收站恢复，收入明细和进展记录会保留。'}`}
        confirmText={`确认${batchPermanent ? '永久删除' : '删除'} ${batchTargets.length} 个项目`}
        destructive
        loading={removeMany.isPending || purgeMany.isPending}
        onConfirm={() => { void deleteSelected().catch(() => {}) }}
      />
    </div>
  )
}
