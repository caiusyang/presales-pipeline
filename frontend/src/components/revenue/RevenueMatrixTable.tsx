import type { RevenueMatrixRow } from '@/api/types'
import type { ID, MonthStr } from '@/types'
import { fmtAmount } from '@/lib/format'
import { cn } from '@/lib/utils'

export function cellKey(projectId: ID, month: MonthStr): string {
  return `${projectId}:${month}`
}

export type ParsedAmount = { ok: true; value: number | null } | { ok: false }

/** 解析单元格文本：空串 → null（清空）；负数/非数值 → 非法；合法则保留两位小数 */
export function parseAmountText(text: string): ParsedAmount {
  const t = text.trim()
  if (t === '') return { ok: true, value: null }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

export interface CellState {
  touched: boolean
  dirty: boolean
  valid: boolean
  /** 当前生效值（非法输入时为 null，仅供展示侧使用） */
  value: number | null
}

/** 汇总某单元格的编辑状态：是否触碰 / 是否与原始值不同 / 是否合法 */
export function getCellState(row: RevenueMatrixRow, month: MonthStr, edits: Map<string, string>): CellState {
  const original = row.amounts[month] ?? null
  const edited = edits.get(cellKey(row.projectId, month))
  if (edited === undefined) return { touched: false, dirty: false, valid: true, value: original }
  const parsed = parseAmountText(edited)
  if (!parsed.ok) return { touched: true, dirty: true, valid: false, value: null }
  return { touched: true, dirty: parsed.value !== original, valid: true, value: parsed.value }
}

interface Props {
  months: MonthStr[]
  rows: RevenueMatrixRow[]
  /** 已触碰单元格的原始输入文本，key 为 `${projectId}:${month}` */
  edits: Map<string, string>
  onCellChange: (projectId: ID, month: MonthStr, text: string) => void
}

/** 项目 × 月份收入录入矩阵：首列吸左、表头吸顶、底部合计行吸底，合计基于当前显示值实时计算 */
export function RevenueMatrixTable({ months, rows, edits, onCellChange }: Props) {
  const displayOf = (row: RevenueMatrixRow, month: MonthStr): string => {
    const edited = edits.get(cellKey(row.projectId, month))
    if (edited !== undefined) return edited
    const v = row.amounts[month]
    return v == null ? '' : String(v)
  }

  /** 参与合计的数值：非法输入按 0 计 */
  const valueOf = (row: RevenueMatrixRow, month: MonthStr): number => {
    const parsed = parseAmountText(displayOf(row, month))
    return parsed.ok && parsed.value != null ? parsed.value : 0
  }

  const rowTotal = (row: RevenueMatrixRow) => months.reduce((sum, m) => sum + valueOf(row, m), 0)
  const colTotals = months.map((m) => rows.reduce((sum, r) => sum + valueOf(r, m), 0))
  const grandTotal = colTotals.reduce((a, b) => a + b, 0)

  const thCls = 'px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap'

  return (
    <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky-th">
          <tr className="border-b">
            <th className={cn(thCls, 'sticky left-0 z-20 min-w-52 text-left')}>项目</th>
            {months.map((m) => (
              <th key={m} title={m} className={cn(thCls, 'min-w-28 text-right')}>
                {Number(m.slice(5))} 月
              </th>
            ))}
            <th className={cn(thCls, 'min-w-28 text-right')}>合计</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.projectId} className="border-b last:border-0 hover:bg-muted/30">
              <td className="sticky left-0 z-10 bg-background px-3 py-1.5">
                <div className="font-medium leading-tight">{row.customerName}</div>
                <div className="text-xs leading-tight text-muted-foreground">{row.projectName}</div>
              </td>
              {months.map((m) => {
                const key = cellKey(row.projectId, m)
                const state = getCellState(row, m, edits)
                const invalid = state.touched && !state.valid
                return (
                  <td key={m} className={cn('px-1.5 py-1', state.dirty && 'bg-amber-50')}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="-"
                      aria-label={`${row.projectName} ${m} 收入（万元）`}
                      value={displayOf(row, m)}
                      onChange={(e) => onCellChange(row.projectId, m, e.target.value)}
                      className={cn(
                        'h-8 w-full min-w-24 rounded border border-input bg-transparent px-2 text-right text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        invalid && 'border-destructive bg-destructive/10',
                      )}
                    />
                  </td>
                )
              })}
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-medium">{fmtAmount(rowTotal(row))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t">
            <td className="sticky bottom-0 left-0 z-20 bg-muted px-3 py-2 text-sm font-semibold">每月合计</td>
            {colTotals.map((total, i) => (
              <td
                key={months[i]}
                className="sticky bottom-0 z-10 whitespace-nowrap bg-muted px-3 py-2 text-right text-sm font-semibold"
              >
                {fmtAmount(total)}
              </td>
            ))}
            <td className="sticky bottom-0 z-10 whitespace-nowrap bg-muted px-3 py-2 text-right text-sm font-semibold">
              {fmtAmount(grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
