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

/** 导出列配置：左侧可选列勾选，右侧已选列排序/改名/移除 */
export function ExportColumnConfig({ fields, columns, onChange }: Props) {
  const selectedKeys = new Set(columns.map((c) => c.key))

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
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">可选列</CardTitle>
          <CardDescription>勾选加入导出，取消勾选移除</CardDescription>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <EmptyState title="该范围暂无可选列" />
          ) : (
            <div className="max-h-80 space-y-1 overflow-auto">
              {fields.map((f) => (
                <div
                  key={f.key}
                  role="checkbox"
                  aria-checked={selectedKeys.has(f.key)}
                  tabIndex={0}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
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
                  <span>{f.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{f.key}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已选列（{columns.length}）</CardTitle>
          <CardDescription>可修改导出列名，顺序即 Excel 列顺序</CardDescription>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <EmptyState title="尚未选择列" description="从左侧勾选需要导出的列" />
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-auto">
              {columns.map((c, i) => (
                <div key={c.key} className="flex items-center gap-1.5">
                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <Input value={c.title} onChange={(e) => setTitle(i, e.target.value)} className="h-8" />
                  <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} title="上移">
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" disabled={i === columns.length - 1} onClick={() => move(i, 1)} title="下移">
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onChange(columns.filter((_, j) => j !== i))} title="移除">
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
