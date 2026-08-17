import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, ArrowRight, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { isValidMonth } from '@/lib/format'
import { PROJECT_FIELD_DEFS } from '@/lib/fields'
import { useCustomFieldDefs, useImportMappings, useMappingMutations } from '@/hooks/queries'
import type { ID, ImportMapping } from '@/types'
import type { ParsedSheet } from './excel'
import {
  buildColumnMap,
  draftsToRules,
  effectiveTarget,
  PROGRESS_TARGET,
  REVENUE_SENTINEL,
} from './importTransform'
import type { ColumnTarget, RuleDraft } from './importTransform'
import { ValueRulesEditor } from './ValueRulesEditor'
import { SaveNameDialog } from './SaveNameDialog'

interface Props {
  parsed: ParsedSheet
  targets: ColumnTarget[]
  onTargetsChange: (t: ColumnTarget[]) => void
  ruleDrafts: RuleDraft[]
  onRuleDraftsChange: (d: RuleDraft[]) => void
  mappingId: ID | null
  mappingName: string
  onApplyMapping: (m: ImportMapping) => void
  onMappingSaved: (id: ID, name: string) => void
  onClearMapping: () => void
  onBack: () => void
  onNext: () => void
}

/** 导入第 2 步：方案载入/另存、列映射表、值映射规则编辑 */
export function StepMapping({
  parsed,
  targets,
  onTargetsChange,
  ruleDrafts,
  onRuleDraftsChange,
  mappingId,
  mappingName,
  onApplyMapping,
  onMappingSaved,
  onClearMapping,
  onBack,
  onNext,
}: Props) {
  const mappings = useImportMappings()
  const mutations = useMappingMutations()
  const { data: customDefs } = useCustomFieldDefs()
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const targetOptions = useMemo(() => {
    const base = PROJECT_FIELD_DEFS.filter((f) => f.editable).map((f) => ({ value: f.key, label: f.label }))
    const progress = { value: PROGRESS_TARGET, label: '进展（多行文本，按换行拆多条）' }
    const custom = (customDefs ?? []).map((d) => ({ value: `custom.${d.fieldKey}`, label: `自定义：${d.label}` }))
    const revenue = { value: REVENUE_SENTINEL, label: '按月收入列（指定月份）' }
    return [...base, progress, ...custom, revenue]
  }, [customDefs])

  // 同一目标被多列选中 → 警告
  const dupKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of targets) {
      const eff = effectiveTarget(t)
      if (eff) counts.set(eff, (counts.get(eff) ?? 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k))
  }, [targets])

  const monthInvalid = (t: ColumnTarget) => t.target === REVENUE_SENTINEL && !isValidMonth(t.month)
  const hasInvalidMonth = targets.some(monthInvalid)
  const hasAnyMapping = targets.some((t) => effectiveTarget(t) != null)
  const canNext = hasAnyMapping && !hasInvalidMonth

  const setTarget = (i: number, t: ColumnTarget) => onTargetsChange(targets.map((old, j) => (j === i ? t : old)))

  const handleSelectMapping = (v: string) => {
    if (!v) {
      onClearMapping()
      return
    }
    const m = (mappings.data ?? []).find((x) => String(x.id) === v)
    if (m) {
      onApplyMapping(m)
      toast.success(`已载入方案「${m.name}」`)
    }
  }

  const handleSave = async (name: string) => {
    setSaving(true)
    try {
      const input = { name, columnMap: buildColumnMap(parsed.headers, targets), valueRules: draftsToRules(ruleDrafts) }
      if (mappingId != null) {
        await mutations.update.mutateAsync({ id: mappingId, input })
        onMappingSaved(mappingId, name)
      } else {
        const created = await mutations.create.mutateAsync(input)
        onMappingSaved(created.id, created.name)
      }
      setSaveOpen(false)
    } catch {
      // 错误提示由 hook 统一 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">映射方案</CardTitle>
          <CardDescription>可载入已存方案自动填充下面的映射配置，调整后也可另存覆盖</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {mappings.isLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <Select
              className="w-64"
              value={mappingId != null ? String(mappingId) : ''}
              onValueChange={handleSelectMapping}
              options={(mappings.data ?? []).map((m) => ({ value: String(m.id), label: m.name }))}
              placeholder="选择已存方案"
              clearable
              clearLabel="不载入方案"
            />
          )}
          {mappingId != null && <Badge variant="info">当前方案：{mappingName}</Badge>}
          <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!hasAnyMapping}>
            <Save /> 另存为方案
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">列映射</CardTitle>
          <CardDescription>为每个 Excel 列选择目标字段，未映射的列将被忽略</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Excel 列名</TableHead>
                  <TableHead>首行示例值</TableHead>
                  <TableHead className="w-72">目标字段</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.headers.map((h, i) => {
                  const t = targets[i] ?? { target: '', month: '' }
                  const eff = effectiveTarget(t)
                  const dup = eff != null && dupKeys.has(eff)
                  const invalid = monthInvalid(t)
                  return (
                    <TableRow key={i} className={dup ? 'bg-amber-50' : undefined}>
                      <TableCell className="font-medium whitespace-nowrap">{h}</TableCell>
                      <TableCell className="max-w-48 truncate text-muted-foreground" title={parsed.rows[0]?.[i] ?? ''}>
                        {parsed.rows[0]?.[i] ?? ''}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            className="flex-1"
                            value={t.target}
                            onValueChange={(v) => setTarget(i, { target: v, month: v === REVENUE_SENTINEL ? t.month : '' })}
                            options={targetOptions}
                            clearable
                            clearLabel="忽略该列"
                          />
                          {t.target === REVENUE_SENTINEL && (
                            <Input
                              type="month"
                              className="w-36"
                              value={t.month}
                              onChange={(e) => setTarget(i, { ...t, month: e.target.value })}
                            />
                          )}
                        </div>
                        {invalid && <div className="mt-1 text-xs text-destructive">请填写有效月份（YYYY-MM）</div>}
                        {dup && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> 该目标字段被多列选中，后列会覆盖前列
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <ValueRulesEditor drafts={ruleDrafts} onChange={onRuleDraftsChange} headers={parsed.headers} dataRows={parsed.rows} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft /> 上一步
        </Button>
        <Button onClick={onNext} disabled={!canNext}>
          下一步：确认执行 <ArrowRight />
        </Button>
      </div>

      <SaveNameDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="另存为映射方案"
        description={mappingId != null ? '将覆盖当前已载入的方案配置' : '保存后可在下次导入时一键载入'}
        nameLabel="方案名称"
        defaultName={mappingName}
        loading={saving}
        onSubmit={(name) => void handleSave(name)}
      />
    </div>
  )
}
