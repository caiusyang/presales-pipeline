import type { EChartsOption } from 'echarts'
import type { RevenueStatItem } from '@/api/types'
import { fmtAmount } from '@/lib/format'

/** 柱状图：x 轴为维度项标签（过长时旋转 30°），y 轴金额（万元） */
export function buildBarOption(items: RevenueStatItem[]): EChartsOption {
  const rotate = items.some((i) => i.label.length > 6) ? 30 : 0
  return {
    grid: { left: 12, right: 16, top: 36, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const arr = params as { name: string; value: number | string }[]
        const p = Array.isArray(arr) ? arr[0] : undefined
        if (!p) return ''
        return `${p.name}<br/>金额：${fmtAmount(Number(p.value))} 万元`
      },
    },
    xAxis: {
      type: 'category',
      data: items.map((i) => i.label),
      axisLabel: { interval: 0, rotate },
    },
    yAxis: { type: 'value', name: '金额（万元）' },
    series: [
      {
        type: 'bar',
        data: items.map((i) => i.amount),
        barMaxWidth: 40,
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
}

const PIE_TOP_N = 10

/** 环形饼图：取前 10 项，其余聚合为「其他」 */
export function buildPieOption(items: RevenueStatItem[]): EChartsOption {
  const top = items.slice(0, PIE_TOP_N)
  const restSum = items.slice(PIE_TOP_N).reduce((sum, i) => sum + i.amount, 0)
  const data = top.map((i) => ({ name: i.label, value: i.amount }))
  if (restSum > 0) data.push({ name: '其他', value: Math.round(restSum * 100) / 100 })
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        return `${p.name}<br/>金额：${fmtAmount(p.value)} 万元（${p.percent}%）`
      },
    },
    legend: { type: 'scroll', bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '46%'],
        label: { formatter: '{b}' },
        data,
      },
    ],
  }
}
