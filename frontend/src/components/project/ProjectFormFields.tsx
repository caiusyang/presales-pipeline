import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCustomFieldDefs, useDictionaries, usePeople } from '@/hooks/queries'
import { industryCascade, PROJECT_FIELD_DEFS, REQUIRED_PROJECT_FIELDS, solutionCascade, type ProjectFieldDef } from '@/lib/fields'
import { cn } from '@/lib/utils'
import { PROJECT_STATUSES, type CustomFieldDef, type DictNode, type ProjectInput } from '@/types'
import { selectableProducts } from '@/lib/products'
import { solutionSelections, withSolutions } from '@/lib/solutions'
import { SolutionSelector } from './SolutionSelector'

interface Props {
  value: ProjectInput
  onChange: (v: ProjectInput) => void
}

const REQUIRED = new Set<string>(REQUIRED_PROJECT_FIELDS)

function dictOptions(nodes: DictNode[] | undefined) {
  return (nodes ?? []).map((n) => ({ value: n.value, label: n.value }))
}

/**
 * 项目基础字段 + 自定义字段的表单渲染，新建 Dialog 与详情概览页签共用。
 * 字典字段渲染为 Select；industry/subIndustry 走行业→子行业级联。
 */
export function ProjectFormFields({ value, onChange }: Props) {
  const industryQ = useDictionaries('industry')
  const trackQ = useDictionaries('track')
  const directionQ = useDictionaries('security_direction')
  const solutionQ = useDictionaries('solution')
  const customDefsQ = useCustomFieldDefs()
  const peopleQ = usePeople()
  const customDefs = (customDefsQ.data ?? []).filter((def) => !def.applicableTracks?.length || def.applicableTracks.includes(value.track))

  const cascade = industryCascade(industryQ.data ?? [])
  const subOptions = dictOptions(value.industry ? cascade.subMap.get(value.industry) : undefined)
  const productOptions = selectableProducts(value.track, value.purchasedProducts)

  const set = (key: string, v: string) => {
    if (key === 'industry') {
      onChange({ ...value, industry: v, subIndustry: '' })
    } else if (key === 'solution') {
      onChange({ ...value, solution: v, subSolution: '' })
    } else if (key === 'subSolution') {
      onChange({ ...value, subSolution: v })
    } else {
      onChange({ ...value, [key]: v })
    }
  }
  const setCustom = (fieldKey: string, v: string) => {
    onChange({ ...value, customFields: { ...value.customFields, [fieldKey]: v } })
  }

  const renderBaseControl = (def: ProjectFieldDef) => {
    const raw = value[def.key as keyof ProjectInput]
    const v = raw == null ? '' : String(raw)
    if (def.kind === 'textarea') {
      return <Textarea value={v} onChange={(e) => set(def.key, e.target.value)} rows={3} />
    }
    if (def.kind === 'number') {
      return (
        <Input
          type="number"
          min="0"
          step="0.01"
          value={v}
          onChange={(e) => set(def.key, e.target.value)}
          placeholder="请输入金额"
        />
      )
    }
    if (def.kind === 'status') {
      return (
        <Select
          value={v}
          onValueChange={(nv) => set(def.key, nv)}
          options={PROJECT_STATUSES.map((status) => ({ value: status, label: status }))}
          placeholder="请选择项目状态"
        />
      )
    }
    if (def.kind === 'dict') {
      if (def.key === 'industry') {
        return (
          <Select
            value={v}
            onValueChange={(nv) => set('industry', nv)}
            options={dictOptions(industryQ.data)}
            placeholder="请选择行业"
            clearable
            clearLabel="未选择"
          />
        )
      }
      if (def.key === 'subIndustry') {
        return (
          <Select
            value={v}
            onValueChange={(nv) => set('subIndustry', nv)}
            options={subOptions}
            placeholder={value.industry ? '请选择子行业' : '请先选择行业'}
            clearable
            clearLabel="未选择"
            disabled={!value.industry}
          />
        )
      }
      const nodes = def.key === 'track' ? trackQ.data : def.key === 'securityDirection' ? directionQ.data : solutionQ.data
      return (
        <Select
          value={v}
          onValueChange={(nv) => set(def.key, nv)}
          options={dictOptions(nodes)}
          placeholder={`请选择${def.label}`}
          clearable
          clearLabel="未选择"
        />
      )
    }
    return <Input type={def.kind === 'date' ? 'date' : 'text'} value={v} onChange={(e) => set(def.key, e.target.value)} />
  }

  const renderCustomControl = (def: CustomFieldDef) => {
    const raw = value.customFields?.[def.fieldKey]
    const v = raw == null ? '' : String(raw)
    switch (def.fieldType) {
      case 'number':
        return <Input type="number" value={v} onChange={(e) => setCustom(def.fieldKey, e.target.value)} />
      case 'date':
        return <Input type="date" value={v} onChange={(e) => setCustom(def.fieldKey, e.target.value)} />
      case 'option':
        return (
          <Select
            value={v}
            onValueChange={(nv) => setCustom(def.fieldKey, nv)}
            options={def.options.map((o) => ({ value: o, label: o }))}
            placeholder={`请选择${def.label}`}
            clearable
            clearLabel="未选择"
          />
        )
      default:
        return <Input value={v} onChange={(e) => setCustom(def.fieldKey, e.target.value)} />
    }
  }

  const solutionKeys = new Set(['solutions', 'solution', 'subSolution', 'purchasedProducts'])
  const baseFields = PROJECT_FIELD_DEFS.filter((f) => f.editable && !solutionKeys.has(f.key) && (f.key !== 'hcsOpportunityId' || value.track === 'HCS'))

  const toggleProduct = (product: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...value.purchasedProducts, product])]
      : value.purchasedProducts.filter((item) => item !== product)
    onChange({ ...value, purchasedProducts: next })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {baseFields.map((def) => (
          <div key={def.key} className={cn('space-y-1.5', def.kind === 'textarea' && 'sm:col-span-2')}>
            <Label>
              {def.label}
              {REQUIRED.has(def.key) && <span className="text-destructive"> *</span>}
            </Label>
            {renderBaseControl(def)}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">方案与产品</div>
          <div className="text-xs text-muted-foreground">
            状态为“中标”时三项必须确认；回退状态后已选内容会保留。
          </div>
        </div>
        <SolutionSelector value={solutionSelections(value)} tree={solutionQ.data ?? []} onChange={(selections) => onChange(withSolutions(value, selections))} />
        <div className="space-y-1.5">
          <Label>已购产品（可多选）{value.projectStatus === '中标' && <span className="text-destructive"> *</span>}</Label>
          {productOptions.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              当前赛道暂无可选产品，请先到“配置 → 产品目录”中添加。
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
              {productOptions.map((product) => (
                <label key={product.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={value.purchasedProducts.includes(product.code)}
                    onCheckedChange={(checked) => toggleProduct(product.code, checked === true)}
                  />
                  {product.name}{!product.enabled && '（已停用）'}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {customDefs.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">自定义字段</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {customDefs.map((def) => (
              <div key={def.fieldKey} className="space-y-1.5">
                <Label>
                  {def.label}
                  {def.required && <span className="text-destructive"> *</span>}
                </Label>
                {renderCustomControl(def)}
              </div>
            ))}
          </div>
        </div>
      )}
      <section className="space-y-2 rounded-lg border p-3"><Label>责任人（可多选，手工来源）</Label><p className="text-xs text-muted-foreground">人员在配置中的责任人库维护。HCS 来源人员未来由同步维护，不会被这里覆盖。</p>
        {peopleQ.isError ? <p className="text-xs text-destructive">责任人库加载失败，请刷新后重试</p> : <div className="flex flex-wrap gap-3">{(peopleQ.data ?? []).filter((p) => p.enabled || value.responsibleIds?.includes(p.id)).map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox checked={value.responsibleIds?.includes(p.id) ?? false} onCheckedChange={(v) => onChange({ ...value, responsibleIds: v ? [...new Set([...(value.responsibleIds ?? []), p.id])] : value.responsibleIds?.filter((id) => id !== p.id) })} />{p.name} {p.employeeNo || p.account ? `（${p.employeeNo || p.account}）` : ''}{!p.enabled && '· 已停用'}</label>)}</div>}
        {!peopleQ.isLoading && !peopleQ.data?.length && <p className="text-xs text-muted-foreground">尚未配置责任人。</p>}
      </section>
    </div>
  )
}
