import type { DictNode, SolutionSelection } from '@/types'
import { solutionCascade } from '@/lib/fields'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
export function SolutionSelector({ value, tree, onChange }: { value: SolutionSelection[]; tree: DictNode[]; onChange: (v: SolutionSelection[]) => void }) {
  const { solutions, subMap } = solutionCascade(tree)
  const change = (index: number, entry: SolutionSelection) => onChange(value.map((s, i) => i === index ? entry : s))
  return <div className="space-y-3">
    {value.map((entry, index) => <div key={index} className="space-y-2 rounded border p-3"><div className="flex gap-2"><Select value={entry.solution} placeholder="选择解决方案" options={solutions.filter((s) => s.value === entry.solution || !value.some((v) => v.solution === s.value)).map((s) => ({ value: s.value, label: s.value }))} onValueChange={(solution) => change(index, { solution, subSolutions: [] })} /><Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}>移除方案</Button></div>
      <div className="flex flex-wrap gap-3">{(subMap.get(entry.solution) ?? []).map((sub) => <label key={sub.id} className="flex items-center gap-2 text-sm"><Checkbox checked={entry.subSolutions.includes(sub.value)} onCheckedChange={(v) => change(index, { ...entry, subSolutions: v ? [...new Set([...entry.subSolutions, sub.value])] : entry.subSolutions.filter((s) => s !== sub.value) })} />{sub.value}</label>)}</div>
      {entry.solution && !(subMap.get(entry.solution)?.length) && <p className="text-xs text-muted-foreground">此方案尚未配置细分方案，可到字典管理维护；中标需至少一组有效父子方案。</p>}
    </div>)}
    <Button variant="outline" size="sm" disabled={value.some((s) => !s.solution)} onClick={() => onChange([...value, { solution: '', subSolutions: [] }])}>增加解决方案</Button>
  </div>
}
