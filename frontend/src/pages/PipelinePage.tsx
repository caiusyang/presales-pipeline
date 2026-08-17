import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { useCustomFieldDefs, useDictionaries, useProjectMutations, useProjects } from '@/hooks/queries'
import { industryCascade } from '@/lib/fields'
import { cn } from '@/lib/utils'
import type { ProjectListQuery } from '@/api/types'
import type { ID, Project } from '@/types'

export default function PipelinePage() {
  // ---------- 筛选状态 ----------
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [industry, setIndustry] = useState('')
  const [track, setTrack] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [recycleBin, setRecycleBin] = useState(false)

  // ---------- 分页 / 排序 ----------
  const [page, setPage] = useState(0) // 0 基，与后端一致
  const [size, setSize] = useState(20)
  const [sort, setSort] = useState<{ sortBy?: string; sortDirection?: 'asc' | 'desc' }>({})

  // ---------- 弹层状态 ----------
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<ID | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  // 关键字防抖 300ms
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => window.clearTimeout(t)
  }, [keyword])

  // 筛选/回收站/每页条数变化回到第 1 页
  useEffect(() => {
    setPage(0)
  }, [debouncedKeyword, industry, track, startMonth, endMonth, recycleBin, size])

  // ---------- 数据 ----------
  const query: ProjectListQuery = {
    page,
    size,
    ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
    ...(industry ? { industry } : {}),
    ...(track ? { track } : {}),
    ...(startMonth ? { startMonth } : {}),
    ...(endMonth ? { endMonth } : {}),
    ...(recycleBin ? { deleted: true } : {}),
    ...(sort.sortBy ? { sortBy: sort.sortBy, sortDirection: sort.sortDirection ?? 'asc' } : {}),
  }
  const projectsQ = useProjects(query)
  const industryQ = useDictionaries('industry')
  const trackQ = useDictionaries('track')
  const customDefsQ = useCustomFieldDefs()
  const { remove } = useProjectMutations()

  const total = projectsQ.data?.total ?? 0
  const items = projectsQ.data?.items ?? []
  const totalPages = Math.max(1, Math.ceil(total / size))

  // ---------- 列配置 ----------
  const availableColumns = useMemo(
    () => buildAvailableColumns(customDefsQ.data ?? []),
    [customDefsQ.data],
  )
  const [columnStates, setColumnStates] = useState<ColumnState[] | null>(null)
  // 与可用列对齐：剔除已删除的列、追加新增列（自定义字段增删时自动生效）
  const effectiveStates = useMemo(() => {
    const base = columnStates ?? loadColumnStates(availableColumns)
    const keys = new Set(availableColumns.map((c) => c.key))
    const merged = base.filter((s) => keys.has(s.key))
    const present = new Set(merged.map((s) => s.key))
    for (const c of availableColumns) {
      if (!present.has(c.key)) merged.push({ key: c.key, visible: c.defaultVisible })
    }
    return merged
  }, [availableColumns, columnStates])

  const updateColumns = (states: ColumnState[]) => {
    setColumnStates(states)
    saveColumnStates(states)
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
          options={trackOptions}
          placeholder="赛道"
          clearable
          clearLabel="全部赛道"
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
          当前查看回收站：此处为已软删除的项目，可恢复回正常列表。
        </div>
      )}

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
            columns={visibleColumns}
            recycleBin={recycleBin}
            sortBy={sort.sortBy}
            sortDirection={sort.sortDirection}
            onSort={toggleSort}
            onOpenDetail={openDetail}
            onRequestDelete={setDeleteTarget}
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
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除项目"
        description={
          deleteTarget
            ? `确定删除「${deleteTarget.customerName} · ${deleteTarget.projectName}」吗？删除为软删除，可在回收站中恢复。`
            : undefined
        }
        confirmText="删除"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
