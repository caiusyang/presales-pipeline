import { useMemo, useState } from 'react'
import { BarChart3, ChartPie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EChart } from '@/components/common/EChart'
import { EmptyState } from '@/components/common/EmptyState'
import { useRevenueStats } from '@/hooks/queries'
import type { StatsDim } from '@/api/types'
import { fmtAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildBarOption, buildPieOption } from './statsChartOption'

const DIM_LABELS: Record<StatsDim, string> = {
  project: '项目',
  industry: '行业',
  month: '月度',
  year: '年度',
}
const DIMS = Object.entries(DIM_LABELS).map(([value, label]) => ({ value: value as StatsDim, label }))

const YEARS = ['2024', '2025', '2026', '2027', '2028']

type ChartType = 'bar' | 'pie'

/** 统计模式：维度切换 + 柱状/饼图 + 汇总表 */
export function RevenueStatsMode() {
  const nowYear = String(new Date().getFullYear())
  const [dim, setDim] = useState<StatsDim>('project')
  const [year, setYear] = useState(YEARS.includes(nowYear) ? nowYear : YEARS[YEARS.length - 1])
  const [chartType, setChartType] = useState<ChartType>('bar')

  // 年度维度不按年过滤，不传 year
  const stats = useRevenueStats(dim, dim === 'year' ? undefined : Number(year))
  const data = stats.data

  const option = useMemo(() => {
    if (!data || data.items.length === 0) return null
    return chartType === 'bar' ? buildBarOption(data.items) : buildPieOption(data.items)
  }, [data, chartType])

  const scopeText = `${DIM_LABELS[dim]}维度 · ${dim === 'year' ? '全部年份' : `${year} 年`}`

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">总金额（万元）</div>
          <div className="mt-1 text-2xl font-semibold">
            {stats.isLoading ? <Skeleton className="h-8 w-24" /> : fmtAmount(data?.total)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">维度项数</div>
          <div className="mt-1 text-2xl font-semibold">
            {stats.isLoading ? <Skeleton className="h-8 w-16" /> : (data?.items.length ?? 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">统计范围</div>
          <div className="mt-1 text-2xl font-semibold">{scopeText}</div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {DIMS.map((d) => (
            <Button
              key={d.value}
              size="sm"
              variant={dim === d.value ? 'default' : 'ghost'}
              className={cn(dim !== d.value && 'text-muted-foreground')}
              onClick={() => setDim(d.value)}
            >
              {d.label}
            </Button>
          ))}
        </div>
        <Select
          className="w-28"
          value={year}
          onValueChange={setYear}
          options={YEARS.map((y) => ({ value: y, label: `${y} 年` }))}
          disabled={dim === 'year'}
          aria-label="年份"
        />
        <div className="ml-auto inline-flex rounded-lg bg-muted p-1">
          <Button
            size="sm"
            variant={chartType === 'bar' ? 'default' : 'ghost'}
            className={cn(chartType !== 'bar' && 'text-muted-foreground')}
            onClick={() => setChartType('bar')}
          >
            <BarChart3 />
            柱状
          </Button>
          <Button
            size="sm"
            variant={chartType === 'pie' ? 'default' : 'ghost'}
            className={cn(chartType !== 'pie' && 'text-muted-foreground')}
            onClick={() => setChartType('pie')}
          >
            <ChartPie />
            饼图
          </Button>
        </div>
      </div>

      {stats.isLoading ? (
        <Skeleton className="h-[380px] w-full" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="暂无统计数据" description={`${scopeText}下没有收入记录`} />
      ) : (
        <>
          <Card className="p-4">{option && <EChart option={option} height={380} />}</Card>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    {DIM_LABELS[data.dimension]}
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">金额（万元）</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">占比</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.key} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{item.label}</td>
                    <td className="px-4 py-2 text-right">{fmtAmount(item.amount)}</td>
                    <td className="px-4 py-2 text-right">
                      {data.total > 0 ? `${((item.amount / data.total) * 100).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50 font-medium">
                  <td className="px-4 py-2.5">合计</td>
                  <td className="px-4 py-2.5 text-right">{fmtAmount(data.total)}</td>
                  <td className="px-4 py-2.5 text-right">{data.total > 0 ? '100.0%' : '-'}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
