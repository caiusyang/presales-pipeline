import { useMemo, useState } from 'react'
import { ListPlus, Plus, Split, Trash2, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PROJECT_FIELD_DEFS, PROJECT_FIELD_LABELS } from '@/lib/fields'
import { useCustomFieldDefs } from '@/hooks/queries'
import type { ExactDraftRow, RuleDraft } from './importTransform'
import { columnUniqueValues } from './importTransform'

interface Props {
  drafts: RuleDraft[]
  onChange: (drafts: RuleDraft[]) => void
  /** Excel 列名（作为规则源列候选） */
  headers: string[]
  /** 数据行（用于提取唯一值参考） */
  dataRows: string[][]
}

/** 值映射规则编辑器：精确对照 / 分隔符拆分 / 固定默认值，三种卡片可增删 */
export function ValueRulesEditor({ drafts, onChange, headers, dataRows }: Props) {
  const { data: customDefs } = useCustomFieldDefs()

  const fieldOptions = useMemo(() => {
    const base = PROJECT_FIELD_DEFS.filter((f) => f.editable).map((f) => ({ value: f.key, label: f.label }))
    const custom = (customDefs ?? []).map((d) => ({ value: `custom.${d.fieldKey}`, label: `自定义：${d.label}` }))
    return [...base, ...custom]
  }, [customDefs])

  const headerOptions = useMemo(() => headers.map((h) => ({ value: h, label: h })), [headers])

  const update = (i: number, draft: RuleDraft) => onChange(drafts.map((d, j) => (j === i ? draft : d)))
  const remove = (i: number) => onChange(drafts.filter((_, j) => j !== i))
  const add = (draft: RuleDraft) => onChange([...drafts, draft])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">值映射规则</span>
        <span className="text-xs text-muted-foreground">执行顺序：拆分 → 精确对照 → 默认值（默认值仅补充空值）</span>
      </div>

      {drafts.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          暂无条件规则，可按需添加（例如「金融-银行」按 - 拆分为行业/子行业）
        </div>
      )}

      {drafts.map((d, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between">
            <Badge variant={d.kind === 'exact' ? 'info' : d.kind === 'split' ? 'warning' : 'secondary'}>
              {d.kind === 'exact' ? '精确对照' : d.kind === 'split' ? '分隔符拆分' : '固定默认值'}
            </Badge>
            <Button variant="ghost" size="icon-sm" onClick={() => remove(i)} title="删除规则">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {d.kind === 'exact' && (
            <ExactCard draft={d} onChange={(nd) => update(i, nd)} headerOptions={headerOptions} fieldOptions={fieldOptions} headers={headers} dataRows={dataRows} />
          )}
          {d.kind === 'split' && (
            <div className="grid gap-2 sm:grid-cols-[1fr_100px_2fr]">
              <Select value={d.source} onValueChange={(v) => update(i, { ...d, source: v })} options={headerOptions} placeholder="选择源列" />
              <Input value={d.delimiter} onChange={(e) => update(i, { ...d, delimiter: e.target.value })} placeholder="分隔符" />
              <div>
                <Input
                  value={d.targetsText}
                  onChange={(e) => update(i, { ...d, targetsText: e.target.value })}
                  placeholder="目标字段序列，如 industry,subIndustry"
                />
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.targetsText
                    .split(/[,，]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((k) => PROJECT_FIELD_LABELS[k] ?? k)
                    .join(' → ') || '按拆分顺序依次写入目标字段'}
                </div>
              </div>
            </div>
          )}
          {d.kind === 'default' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={d.field} onValueChange={(v) => update(i, { ...d, field: v })} options={fieldOptions} placeholder="选择目标字段" />
              <Input value={d.value} onChange={(e) => update(i, { ...d, value: e.target.value })} placeholder="为空时补充的常量值" />
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => add({ kind: 'exact', source: '', rows: [{ src: '', field: '', value: '' }] })}>
          <ListPlus /> 添加精确对照
        </Button>
        <Button variant="outline" size="sm" onClick={() => add({ kind: 'split', source: '', delimiter: '-', targetsText: '' })}>
          <Split /> 添加分隔符拆分
        </Button>
        <Button variant="outline" size="sm" onClick={() => add({ kind: 'default', field: '', value: '' })}>
          <Wand2 /> 添加固定默认值
        </Button>
      </div>
    </div>
  )
}

function ExactCard({
  draft,
  onChange,
  headerOptions,
  fieldOptions,
  headers,
  dataRows,
}: {
  draft: Extract<RuleDraft, { kind: 'exact' }>
  onChange: (d: Extract<RuleDraft, { kind: 'exact' }>) => void
  headerOptions: { value: string; label: string }[]
  fieldOptions: { value: string; label: string }[]
  headers: string[]
  dataRows: string[][]
}) {
  const [showUniques, setShowUniques] = useState(false)
  const colIdx = headers.indexOf(draft.source)
  const uniques = colIdx >= 0 ? columnUniqueValues(dataRows, colIdx) : []

  const setRow = (i: number, row: ExactDraftRow) =>
    onChange({ ...draft, rows: draft.rows.map((r, j) => (j === i ? row : r)) })
  const removeRow = (i: number) => onChange({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select value={draft.source} onValueChange={(v) => onChange({ ...draft, source: v })} options={headerOptions} placeholder="选择源列" />
        <Button variant="ghost" size="sm" disabled={colIdx < 0} onClick={() => setShowUniques((s) => !s)}>
          提取该列唯一值
        </Button>
      </div>
      {showUniques && (
        <div className="flex flex-wrap gap-1 rounded-md bg-muted/50 p-2">
          {uniques.length === 0 && <span className="text-xs text-muted-foreground">该列暂无值</span>}
          {uniques.map((v) => (
            <Badge key={v} variant="outline" className="font-normal">
              {v}
            </Badge>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <div className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 text-xs text-muted-foreground">
          <span>源值（与该列单元格完全一致）</span>
          <span>目标字段</span>
          <span>目标值</span>
          <span />
        </div>
        {draft.rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] items-center gap-2">
            <Input value={r.src} onChange={(e) => setRow(i, { ...r, src: e.target.value })} placeholder="如：金融行业" />
            <Select value={r.field} onValueChange={(v) => setRow(i, { ...r, field: v })} options={fieldOptions} placeholder="字段" />
            <Input value={r.value} onChange={(e) => setRow(i, { ...r, value: e.target.value })} placeholder="如：金融" />
            <Button variant="ghost" size="icon-sm" onClick={() => removeRow(i)} title="删除行">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...draft, rows: [...draft.rows, { src: '', field: '', value: '' }] })}>
          <Plus /> 添加一行（同一源值可多条，写多个字段）
        </Button>
      </div>
    </div>
  )
}
