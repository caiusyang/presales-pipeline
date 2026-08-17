import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { useDictionaries, useRevenueMatrix, useSaveRevenues } from '@/hooks/queries'
import type { RevenueEntry, RevenueMatrixParams } from '@/api/types'
import type { ID, MonthStr } from '@/types'
import { useDebouncedValue } from './useDebouncedValue'
import { RevenueMatrixTable, cellKey, getCellState } from './RevenueMatrixTable'

const YEARS = ['2024', '2025', '2026', '2027', '2028']

/** 录入模式：项目 × 月份矩阵批量编辑与保存 */
export function RevenueEntryMode() {
  const nowYear = String(new Date().getFullYear())
  const [year, setYear] = useState(YEARS.includes(nowYear) ? nowYear : YEARS[YEARS.length - 1])
  const [industry, setIndustry] = useState('')
  const [track, setTrack] = useState('')
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword, 300)
  /** 已触碰单元格的原始输入文本 */
  const [edits, setEdits] = useState<Map<string, string>>(new Map())

  const industryDicts = useDictionaries('industry')
  const trackDicts = useDictionaries('track')

  const params: RevenueMatrixParams = {
    year: Number(year),
    ...(industry ? { industry } : {}),
    ...(track ? { track } : {}),
    ...(debouncedKeyword.trim() ? { keyword: debouncedKeyword.trim() } : {}),
  }
  const matrix = useRevenueMatrix(params)
  const save = useSaveRevenues()

  // 筛选条件变化时放弃未保存的修改（避免把旧条件的数据误存）
  useEffect(() => {
    setEdits(new Map())
  }, [year, industry, track, debouncedKeyword])

  const months = matrix.data?.months ?? []
  const rows = matrix.data?.rows ?? []

  /** 与原始值不同（含非法输入）的变更单元格 */
  const dirtyEntries = useMemo(() => {
    const list: { projectId: ID; month: MonthStr; amount: number | null; valid: boolean }[] = []
    for (const row of rows) {
      for (const m of months) {
        if (!edits.has(cellKey(row.projectId, m))) continue
        const state = getCellState(row, m, edits)
        if (!state.dirty) continue
        list.push({ projectId: row.projectId, month: m, amount: state.value, valid: state.valid })
      }
    }
    return list
  }, [edits, rows, months])

  const handleCellChange = (projectId: ID, month: MonthStr, text: string) => {
    setEdits((prev) => {
      const next = new Map(prev)
      next.set(cellKey(projectId, month), text)
      return next
    })
  }

  const handleSave = () => {
    if (dirtyEntries.some((e) => !e.valid)) {
      toast.error('存在非法金额（负数或非数值），请修正后再保存')
      return
    }
    const entries: RevenueEntry[] = dirtyEntries.map((e) => ({
      projectId: e.projectId,
      month: e.month,
      amount: e.amount,
    }))
    save.mutate(entries, { onSuccess: () => setEdits(new Map()) })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-28"
          value={year}
          onValueChange={setYear}
          options={YEARS.map((y) => ({ value: y, label: `${y} 年` }))}
          aria-label="年份"
        />
        <Select
          className="w-40"
          value={industry}
          onValueChange={setIndustry}
          options={(industryDicts.data ?? []).map((d) => ({ value: d.value, label: d.value }))}
          placeholder="全部行业"
          clearable
          aria-label="行业"
        />
        <Select
          className="w-40"
          value={track}
          onValueChange={setTrack}
          options={(trackDicts.data ?? []).map((d) => ({ value: d.value, label: d.value }))}
          placeholder="全部赛道"
          clearable
          aria-label="赛道"
        />
        <Input
          className="w-56"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索客户 / 项目关键字"
          aria-label="关键字"
        />
        <Button
          className="ml-auto"
          disabled={dirtyEntries.length === 0 || save.isPending}
          onClick={handleSave}
        >
          {save.isPending ? '保存中…' : `保存变更（${dirtyEntries.length}）`}
        </Button>
      </div>

      {matrix.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="暂无项目" description="当前筛选条件下没有项目，可调整年份 / 行业 / 赛道 / 关键字" />
      ) : (
        <RevenueMatrixTable months={months} rows={rows} edits={edits} onCellChange={handleCellChange} />
      )}
    </div>
  )
}
