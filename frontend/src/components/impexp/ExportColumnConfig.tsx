import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/common/EmptyState'
import type { ExportColumn } from '@/types'
import type { ExportFieldOption } from '@/api/types'

interface Props {
  /** 当前 scope 的全部可选列 */
  fields: ExportFieldOption[]
  /** 已选列（数组顺序即导出列顺序） */
  columns: ExportColumn[]
  onChange: (cols: ExportColumn[]) => void
}

export function toggleAllExportColumns(
  fields: ExportFieldOption[],
  columns: ExportColumn[],
): ExportColumn[] {
  const selectedKeys = new Set(columns.map((column) => column.key))
  const allSelected = fields.length > 0 && fields.every((field) => selectedKeys.has(field.key))
  if (allSelected) return []
  return [
    ...columns,
    ...fields
      .filter((field) => !selectedKeys.has(field.key))
      .map((field) => ({ key: field.key, title: field.title })),
  ]
}

/** 导出列配置：左侧可选列勾选，右侧已选列排序/改名/移除 */
export function ExportColumnConfig({ fields, columns, onChange }: Props) {
  const selectedKeys = new Set(columns.map((c) => c.key))
  const allSelected = fields.length > 0 && fields.every((field) => selectedKeys.has(field.key))

  const toggle = (f: ExportFieldOption, checked: boolean) => {
    if (checked) onChange([...columns, { key: f.key, title: f.title }])
    else onChange(columns.filter((c) => c.key !== f.key))
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= columns.length) return
    const next = [...columns]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const setTitle = (i: number, title: string) =>
    onChange(columns.map((c, j) => (j === i ? { ...c, title } : c)))

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader className="min-h-24">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">可选列</CardTitle>
              <CardDescription>勾选加入导出，取消勾选移除</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={fields.length === 0}
              onClick={() => onChange(toggleAllExportColumns(fields, columns))}
            >
              {allSelected ? '取消全选' : '全选'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="flex h-80 items-center justify-center"><EmptyState title="该范围暂无可选列" /></div>
          ) : (
            <div className="h-80 space-y-1 overflow-y-auto pr-1">
              {fields.map((f) => (
                <div
                  key={f.key}
                  role="checkbox"
                  aria-checked={selectedKeys.has(f.key)}
                  tabIndex={0}
                  className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => toggle(f, !selectedKeys.has(f.key))}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      toggle(f, !selectedKeys.has(f.key))
                    }
                  }}
                >
                  <Checkbox
                    checked={selectedKeys.has(f.key)}
                    onCheckedChange={(v) => toggle(f, v === true)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="min-w-0 flex-1 break-words">{f.title}</span>
                  <span className="max-w-[42%] truncate text-xs text-muted-foreground" title={f.key}>{f.key}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="min-h-24">
          <CardTitle className="text-base">已选列（{columns.length}）</CardTitle>
          <CardDescription>可修改导出列名，顺序即 Excel 列顺序</CardDescription>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <div className="flex h-80 items-center justify-center"><EmptyState title="尚未选择列" description="从可选列中勾选需要导出的列" /></div>
          ) : (
            <div className="h-80 space-y-1 overflow-y-auto pr-1">
              {columns.map((c, i) => (
                <div key={c.key} className="flex min-h-9 items-center gap-1.5">
                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <Input aria-label={`第 ${i + 1} 列名称`} value={c.title} onChange={(e) => setTitle(i, e.target.value)} className="h-8 min-w-0 flex-1" />
                  <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} title="上移" aria-label={`上移第 ${i + 1} 列`}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" disabled={i === columns.length - 1} onClick={() => move(i, 1)} title="下移" aria-label={`下移第 ${i + 1} 列`}>
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onChange(columns.filter((_, j) => j !== i))} title="移除" aria-label={`移除第 ${i + 1} 列`}>
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
