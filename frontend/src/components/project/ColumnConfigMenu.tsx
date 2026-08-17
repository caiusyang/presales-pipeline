import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ColumnState, PipelineColumn } from '@/components/project/columns'

interface Props {
  columns: PipelineColumn[]
  states: ColumnState[]
  onChange: (states: ColumnState[]) => void
}

/** 列配置菜单：显隐勾选 + 上移/下移排序 */
export function ColumnConfigMenu({ columns, states, onChange }: Props) {
  const labelOf = (key: string) => columns.find((c) => c.key === key)?.label ?? key

  const toggle = (key: string, visible: boolean) => {
    onChange(states.map((s) => (s.key === key ? { ...s, visible } : s)))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= states.length) return
    const next = [...states]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Settings2 className="h-4 w-4" />
          列配置
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
        <DropdownMenuLabel>显示列与顺序</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {states.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
            <Checkbox
              checked={s.visible}
              onCheckedChange={(checked) => toggle(s.key, checked === true)}
              aria-label={`显示${labelOf(s.key)}`}
            />
            <span className="flex-1 truncate">{labelOf(s.key)}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label="上移"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={i === states.length - 1}
              onClick={() => move(i, 1)}
              aria-label="下移"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
