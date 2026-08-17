import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCustomFieldDefs, useDictionaries } from '@/hooks/queries'
import { industryCascade, PROJECT_FIELD_DEFS, REQUIRED_PROJECT_FIELDS, type ProjectFieldDef } from '@/lib/fields'
import { cn } from '@/lib/utils'
import type { CustomFieldDef, DictNode, ProjectInput } from '@/types'

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
  const solutionQ = useDictionaries('solution')
  const customDefsQ = useCustomFieldDefs()
  const customDefs = customDefsQ.data ?? []

  const cascade = industryCascade(industryQ.data ?? [])
  const subOptions = dictOptions(value.industry ? cascade.subMap.get(value.industry) : undefined)

  const set = (key: string, v: string) => {
    if (key === 'industry') {
      onChange({ ...value, industry: v, subIndustry: '' })
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
      const nodes = def.key === 'track' ? trackQ.data : solutionQ.data
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
    return <Input value={v} onChange={(e) => set(def.key, e.target.value)} />
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

  const baseFields = PROJECT_FIELD_DEFS.filter((f) => f.editable)

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
    </div>
  )
}
