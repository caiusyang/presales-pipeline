import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { PROJECT_FIELD_DEFS, appliesToTrack } from '@/lib/fields'
import { SolutionSelector } from '@/components/project/SolutionSelector'
import { solutionSelections } from '@/lib/solutions'
import type { CustomFieldDef, DictNode } from '@/types'
import type { ImportRecordInput } from '@/api/types'
import { applyEdits, fieldValue, optionsForField, valueText, productValues } from './importReview'
import type { FieldEdits } from './importReview'

export function ImportRowEditor({ record, edits, cells, headers, original, defs, dictionaries, onSave, onClose }: {
  record: ImportRecordInput; edits: FieldEdits; cells: Record<number, string>; headers: string[]; original: string[];
  defs: CustomFieldDef[]; dictionaries: DictNode[]; onSave: (edits: FieldEdits, cells: Record<number, string>) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(edits)
  const [draftCells, setDraftCells] = useState(cells)
  const fields = applyEdits(record, draft).fields
  const options = [...PROJECT_FIELD_DEFS.filter((f) => f.editable && !['solution', 'subSolution'].includes(f.key)).map((f) => ({ key: f.key as string, label: f.label })), ...defs.filter((d) => appliesToTrack(d, fields.track)).map((d) => ({ key: `custom.${d.fieldKey}`, label: d.label }))]
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-h-[85vh] max-w-3xl overflow-auto">
      <DialogHeader><DialogTitle>修正第 {record.sourceRow} 行</DialogTitle><DialogDescription>修改后重新预检；原始内容保留。收入、日期和进展格式问题可展开原始单元格修正。</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">{options.map(({ key, label }) => {
        const allowed = optionsForField(key, fields, dictionaries, defs)
        const value = valueText(fieldValue(fields, key))
        return <div key={key} className="space-y-1 text-xs"><label htmlFor={`edit-${key}`}>{label}</label>
          {key === 'solutions' ? <SolutionSelector value={Array.isArray(fields.solutions) ? fields.solutions : solutionSelections({ solution: fields.solution, subSolution: fields.subSolution })} tree={dictionaries.filter((d) => d.type === 'solution')} onChange={(v) => setDraft({ ...draft, solutions: v })} /> : key === 'purchasedProducts' ? <div className="space-y-1 rounded border p-2"><div>当前：{value || '未填写'}</div>
            {(allowed ?? []).map((p) => <label key={p} className="mr-2 inline-flex gap-1"><input type="checkbox" checked={productValues(fieldValue(fields, key)).includes(p)} onChange={(e) => {
              const chosen = new Set(productValues(fieldValue(fields, key))); if (e.target.checked) chosen.add(p); else chosen.delete(p); setDraft({ ...draft, [key]: [...chosen] })
            }} />{p}</label>)}<Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, [key]: [] })}>清空后重选</Button>
          </div> : allowed ? <Select id={`edit-${key}`} value={value} clearable clearLabel="未填写" onValueChange={(v) => setDraft({ ...draft, [key]: v })}
            options={[...(value && !allowed.includes(value) ? [{ value, label: `${value}（当前值）` }] : []), ...allowed.map((v) => ({ value: v, label: v }))]} />
            : <Input id={`edit-${key}`} list={key === 'customerName' ? 'import-customers' : undefined} value={value} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />}
          <p className="text-muted-foreground">导入值：{valueText(fieldValue(record.fields, key)) || '空'}</p>
          {Object.hasOwn(draft, key) && <button type="button" className="text-sky-700" onClick={() => { const next = { ...draft }; delete next[key]; setDraft(next) }}>撤销此字段的单行修正</button>}
        </div>
      })}</div>
      <details><summary className="cursor-pointer text-sm">原始单元格（修正收入、日期、进展）</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
        {headers.map((header, index) => <label key={index} className="space-y-1 text-xs">{header}<Input aria-label={`原始列 ${header}`} value={draftCells[index] ?? original[index]} onChange={(e) => setDraftCells({ ...draftCells, [index]: e.target.value })} /></label>)}
      </div></details>
      <Button onClick={() => onSave(draft, draftCells)}>保存修正并预检</Button>
    </DialogContent>
  </Dialog>
}
