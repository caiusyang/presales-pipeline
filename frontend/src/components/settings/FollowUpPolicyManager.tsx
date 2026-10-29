import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useFollowUpPolicy, useSaveFollowUpPolicy, useFollowUpFields } from '@/hooks/queries'
import { normalizeFollowUpPolicy, validateFollowUpPolicy, type FollowUpPolicy } from '@/lib/followUp'

export function FollowUpPolicyManager() {
  const policyQ = useFollowUpPolicy(), fieldsQ = useFollowUpFields(), save = useSaveFollowUpPolicy()
  const [fieldKey, setFieldKey] = useState(''), [defaultDays, setDefaultDays] = useState('')
  const [rules, setRules] = useState<{ value: string; days: string }[]>([])
  useEffect(() => {
    if (policyQ.data) { const p = normalizeFollowUpPolicy(policyQ.data); setFieldKey(p.fieldKey); setDefaultDays(String(p.defaultDays)); setRules(p.rules.map((r) => ({ value: r.value, days: String(r.days) }))) }
  }, [policyQ.data])
  const field = fieldsQ.data?.find((f) => f.key === fieldKey)
  const input: FollowUpPolicy = { fixedTargetDays: policyQ.data?.fixedTargetDays ?? 7, normalDays: policyQ.data?.normalDays ?? 14, fieldKey, defaultDays: Number(defaultDays), rules: rules.map((r) => ({ value: r.value, days: Number(r.days) })) }
  const error = !fieldKey ? '请选择关联字段' : ![defaultDays, ...rules.map((r) => r.days)].every((value) => /^\d+$/.test(value)) ? '请输入整数天数' : validateFollowUpPolicy(input, fieldsQ.data ?? [])
  const snapshot = (policy: FollowUpPolicy) => { const p = normalizeFollowUpPolicy(policy); return JSON.stringify([p.fieldKey, p.defaultDays, p.rules]) }
  const changed = !!policyQ.data && snapshot(input) !== snapshot(policyQ.data)
  const ready = !!policyQ.data && !!fieldsQ.data && !policyQ.isError && !fieldsQ.isError
  const updateRule = (index: number, changes: Partial<typeof rules[number]>) => setRules((current) => current.map((r, i) => i === index ? { ...r, ...changes } : r))
  return <section className="space-y-4 rounded-md border p-4">
    <div><h2 className="font-medium">字段关联与跟进周期</h2><p className="mt-1 text-sm text-muted-foreground">选择一个系统分类字段或自定义文本／选项字段，为不同值设置周期。只提醒未中标且未删除的项目。</p></div>
    {policyQ.isError || fieldsQ.isError ? <p role="alert" className="text-sm text-destructive">规则或字段读取失败，无法修改。<Button variant="link" onClick={() => { void policyQ.refetch(); void fieldsQ.refetch() }}>重试</Button></p> : <>
      <div className="grid max-w-lg gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="follow-up-field">关联字段</Label><Select id="follow-up-field" value={fieldKey} placeholder="选择关联字段" options={(fieldsQ.data ?? []).map((f) => ({ value: f.key, label: f.label }))} disabled={!ready || save.isPending} onValueChange={(key) => { setFieldKey(key); setRules([]) }} /></div>
        <div className="space-y-2"><Label htmlFor="default-follow-up-days">未匹配时的默认周期（天）</Label><Input id="default-follow-up-days" type="number" min="1" max="3650" step="1" value={defaultDays} onChange={(e) => setDefaultDays(e.target.value)} disabled={!ready || save.isPending} /></div>
      </div>
      <div className="max-w-2xl space-y-2">
        {rules.map((rule, index) => <div className="flex flex-wrap items-center gap-2" key={index}>
          {field?.type === 'option' ? <Select className="w-64" aria-label={`规则 ${index + 1} 字段值`} value={rule.value} placeholder="选择字段值" options={[...field.options, ...(!field.options.some((o) => o.value === rule.value) && rule.value ? [{ value: rule.value, label: `${rule.value}（选项已失效）` }] : [])]} disabled={save.isPending} onValueChange={(value) => updateRule(index, { value })} /> : <Input className="w-64" aria-label={`规则 ${index + 1} 字段值`} placeholder="输入要匹配的完整字段值" maxLength={255} value={rule.value} disabled={save.isPending} onChange={(e) => updateRule(index, { value: e.target.value })} />}
          <span className="text-sm">每</span><Input className="w-24" aria-label={`规则 ${index + 1} 周期`} type="number" min="1" max="3650" step="1" value={rule.days} disabled={save.isPending} onChange={(e) => updateRule(index, { days: e.target.value })} /><span className="text-sm">天跟进</span>
          <Button variant="ghost" disabled={save.isPending} aria-label={`移除规则 ${index + 1}`} onClick={() => setRules((current) => current.filter((_, i) => i !== index))}>移除</Button>
        </div>)}
        <Button variant="outline" disabled={!ready || !field || rules.length >= 100 || save.isPending} onClick={() => setRules((current) => [...current, { value: field?.type === 'option' ? field.options.find((o) => !current.some((r) => r.value === o.value))?.value ?? '' : '', days: defaultDays }])}>新增字段值规则</Button>
      </div>
      {error && ready && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">精确匹配完整值，忽略首尾空白和英文字母大小写；空值、未配置的值及不适用当前赛道的字段使用默认周期。切换字段只修改本页草稿，保存后生效，不自动迁移原字段值。</p>
      <Button disabled={!ready || !!error || !changed || save.isPending} onClick={() => save.mutate(input)}>{save.isPending ? '保存中…' : '保存跟进周期'}</Button>
    </>}
    <p className="text-sm text-muted-foreground">周期为 1—3650 天整数。按上海自然日计算，到周期当天开始提醒。基准是最后一次实际业务变更时间；没有该时间时使用创建时间。查看、导出、无变化保存和调整关联规则均不重置项目跟进时间。下次行动日期提醒单独保留；数值范围、多选字段和多字段组合条件暂不支持。</p>
  </section>
}
