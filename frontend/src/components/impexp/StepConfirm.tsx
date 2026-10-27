import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHead, TableHeader, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useCustomFieldDefs, useCustomers, useDictionaries, useImportRecords, useMappingMutations } from '@/hooks/queries'
import type { ID, CustomFieldDef, ValueRule } from '@/types'
import type { ImportIssue, ImportRecordResult, ImportResult } from '@/api/types'
import type { ParsedSheet } from './excel'
import type { PendingCustomField } from './importTransform'
import { buildImportRecords } from './importTransform'
import { applyEdits, excludeImportRows, fieldContext, fieldLabel, fieldValue, localImportIssues, mappingRule, optionsForField, pendingImportRecords, recordsForPreflight, valueText } from './importReview'
import type { ReviewSession } from './importReview'
import { SaveNameDialog } from './SaveNameDialog'
import { ImportRowEditor } from './ImportRowEditor'

interface Props {
  parsed: ParsedSheet; columnMap: Record<string, string>; valueRules: ValueRule[];
  mappingId: ID | null; mappingName: string; pendingFields: PendingCustomField[];
  session: ReviewSession; onSessionChange: (session: ReviewSession) => void;
  onMappingSaved: (id: ID, name: string, rules: ValueRule[]) => void; active: boolean; onBack: () => void; onReset: () => void;
}

export function StepConfirm({ parsed, columnMap, valueRules, mappingId, mappingName, pendingFields, session, onSessionChange, onMappingSaved, active, onBack, onReset }: Props) {
  const importer = useImportRecords(), mappings = useMappingMutations()
  const dictionaries = useDictionaries(), customs = useCustomFieldDefs(), customers = useCustomers('')
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const [preview, setPreview] = useState<{ key: string; result: ImportResult } | null>(null)
  const [previewError, setPreviewError] = useState(''), [retry, setRetry] = useState(0)
  const [executing, setExecuting] = useState(false), [uncertain, setUncertain] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false), [saveOpen, setSaveOpen] = useState(false)
  const [filter, setFilter] = useState('all'), [issueFilter, setIssueFilter] = useState(''), [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set()), [customer, setCustomer] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [lastResults, setLastResults] = useState<ImportRecordResult[]>([])
  const generation = useRef(0)
  const transformed = useMemo(() => buildImportRecords({
    headers: parsed.headers, rows: parsed.rows.map((row, i) => row.map((cell, j) => session.cells[parsed.dataStartRow + i]?.[j] ?? cell)),
    columnMap, valueRules, today, dataStartRow: parsed.dataStartRow,
  }), [parsed, columnMap, valueRules, session.cells, today])
  const records = useMemo(() => transformed.records.map((r) => applyEdits(applyEdits(r, session.bulk[r.sourceRow!]), session.edits[r.sourceRow!])), [transformed, session.bulk, session.edits])
  const originalByRow = useMemo(() => new Map(buildImportRecords({ headers: parsed.headers, rows: parsed.rows,
    columnMap, valueRules: valueRules.filter((rule) => rule.type !== 'exact' || !rule.matchField), today, dataStartRow: parsed.dataStartRow,
  }).records.map((record) => [record.sourceRow!, record])), [parsed, columnMap, valueRules, today])
  const remaining = useMemo(() => pendingImportRecords(records, session), [records, session.completed, session.excluded])
  const previewRecords = useMemo(() => recordsForPreflight(remaining, transformed.problems), [remaining, transformed.problems])
  const signature = JSON.stringify({ remaining, problems: transformed.problems, pendingFields, mappingId, retry })
  const currentPreview = preview?.key === signature ? preview.result : null
  const defs: CustomFieldDef[] = useMemo(() => {
    const result = [...(customs.data ?? [])]
    pendingFields.forEach((f) => { if (!result.some((d) => d.fieldKey === f.fieldKey)) result.push({ ...f, id: 0, required: false, options: [], sortOrder: 0 }) })
    return result
  }, [customs.data, pendingFields])

  useEffect(() => {
    if (!active || executing || uncertain || !remaining.length) return
    const version = ++generation.current
    let cancelled = false
    setPreviewError('')
    const timer = window.setTimeout(async () => {
      try {
        const result = previewRecords.length
          ? await importer.mutateAsync({ mappingId, dryRun: true, records: previewRecords, pendingFields })
          : { mappingId, dryRun: true, added: 0, overwritten: 0, skipped: 0, details: [] }
        if (!cancelled && generation.current === version) setPreview({ key: signature, result })
      } catch (error) { if (!cancelled) setPreviewError((error as Error).message || '预检失败，请重试') }
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
    // signature 是完整请求的快照；mutation 对象变化不触发重新预检。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, signature, executing, uncertain])

  const resultsByRow = new Map(currentPreview?.details.map((result) => [result.sourceRow, result]))
  const problemsByRow = new Map<number, typeof transformed.problems>()
  transformed.problems.forEach((problem) => problemsByRow.set(problem.excelRow, [...(problemsByRow.get(problem.excelRow) ?? []), problem]))
  const rows = remaining.map((record) => {
    const sourceRow = record.sourceRow!
    const result = resultsByRow.get(sourceRow)
    const issues: ImportIssue[] = [...(result?.issues ?? (result?.reason ? [{ field: '_record', code: 'validation', message: result.reason }] : []))]
    issues.push(...localImportIssues(record, problemsByRow.get(sourceRow) ?? []))
    return { sourceRow, record, result, issues,
      ready: Boolean(result && ['added', 'overwritten'].includes(result.status)) && !issues.length }
  })
  const ready = rows.filter((r) => r.ready), unresolved = rows.filter((r) => !r.ready)
  const completedCount = Object.keys(session.completed).length, excludedCount = Object.keys(session.excluded).length
  const selectedRows = rows.filter((row) => selected.has(row.sourceRow))
  const shown = rows.filter((r) => (filter === 'all' || (filter === 'ready' ? r.ready : !r.ready)) && (!issueFilter || r.issues.some((i) => i.field === issueFilter)))
  const pageCount = Math.max(1, Math.ceil(shown.length / 30)), pageIndex = Math.min(page, pageCount - 1)
  const pageRows = shown.slice(pageIndex * 30, (pageIndex + 1) * 30)
  const groups = new Map<string, { field: string; from: string; when: Record<string, string>; rows: number[]; options: string[] }>()
  rows.forEach((r) => {
    const fields = r.result?.effectiveFields ?? r.record.fields
    r.issues.filter((i) => i.code === 'option').forEach((issue) => {
      const from = valueText(fieldValue(fields, issue.field)), when = fieldContext(issue.field, fields)
      const key = JSON.stringify([issue.field, from, when]), options = optionsForField(issue.field, fields, dictionaries.data ?? [], defs)
      if (!options) return
      const group = groups.get(key) ?? { field: issue.field, from, when, rows: [], options }
      if (!group.rows.includes(r.sourceRow)) group.rows.push(r.sourceRow)
      groups.set(key, group)
    })
  })
  const editingRow = rows.find((r) => r.sourceRow === editing)
  const editingBase = editingRow ? applyEdits(
    { ...editingRow.record, fields: editingRow.result?.effectiveFields ?? editingRow.record.fields },
    Object.fromEntries(Object.keys(session.edits[editingRow.sourceRow] ?? {}).map((key) => [key,
      fieldValue(applyEdits(transformed.records.find((record) => record.sourceRow === editingRow.sourceRow)!, session.bulk[editingRow.sourceRow]).fields, key),
    ])),
  ) : null

  const download = () => {
    const headers = ['Excel原行号', ...parsed.headers.map((h) => `原始：${h}`), ...parsed.headers.map((h) => `当前：${h}`), '当前项目字段', '待处理问题']
    const data = rows.map((r) => {
      const original = parsed.rows[r.sourceRow - parsed.dataStartRow]
      return [r.sourceRow, ...original, ...original.map((cell, j) => session.cells[r.sourceRow]?.[j] ?? cell), JSON.stringify(r.result?.effectiveFields ?? r.record.fields), r.issues.map((i) => i.message).join('；') || (r.ready ? '已通过，尚未导入' : '等待预检')]
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...data]), '待处理清单')
    XLSX.writeFile(workbook, '导入待处理清单.xlsx')
  }
  const saveRules = async (name: string) => {
    const input = { name, columnMap, valueRules: [...valueRules, ...session.rules] }
    const saved = mappingId == null ? await mappings.create.mutateAsync(input) : await mappings.update.mutateAsync({ id: mappingId, input })
    onMappingSaved(saved.id, saved.name, input.valueRules); setSaveOpen(false)
  }
  const runImport = async () => {
    if (!currentPreview || !ready.length || executing || uncertain) return
    setExecuting(true); generation.current++
    try {
      const result = await importer.mutateAsync({ mappingId, dryRun: false, records: ready.map((r) => r.record), pendingFields })
      const completed = { ...session.completed }
      result.details.forEach((r) => { if (['added', 'overwritten'].includes(r.status) && r.sourceRow != null) completed[r.sourceRow] = r })
      setLastResults(result.details.filter((r) => !['added', 'overwritten'].includes(r.status)))
      onSessionChange({ ...session, completed }); setSelected(new Set())
      setFilter('all'); setIssueFilter(''); setPage(0)
      toast.success(`已导入 ${result.added + result.overwritten} 条，未通过 ${result.skipped} 条继续保留`)
    } catch {
      setUncertain(true); setPreviewError('执行结果未确认。请核对项目数据，再点击重新预检；系统不会自动重试导入。')
    } finally { setConfirmOpen(false); setPreview(null); setExecuting(false) }
  }

  return <div className="space-y-4">
    <Card><CardContent className="space-y-3 pt-5">
      <div className="flex flex-wrap gap-6 text-sm"><span>可导入 <b>{ready.length}</b> 条</span><span>待处理 <b>{unresolved.length}</b> 条</span><span>已导入 <b>{completedCount}</b> 条</span>{excludedCount > 0 && <span>已移除 <b>{excludedCount}</b> 条</span>}
        {!currentPreview && remaining.length > 0 && <span className="text-muted-foreground">{previewError || '正在重新预检…'}</span>}</div>
      <p className="text-xs text-muted-foreground">修正后自动重新预检；成功导入后从列表移除，剩余记录可继续修正或勾选删除。删除仅移出本次导入清单，不影响已有项目，可在本页恢复。待处理进度保留在当前页面。</p>
      {pendingFields.length > 0 && <p className="text-xs">待新增字段：{pendingFields.map((f) => `${f.label}（${{ text: '文本', number: '数字', date: '日期' }[f.fieldType]}）`).join('、')}</p>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={executing} onClick={() => { setUncertain(false); setPreviewError(''); setRetry((n) => n + 1) }}>重新预检</Button>
        <Button variant="outline" disabled={executing || !remaining.length} onClick={download}>下载未导入清单</Button>
        {excludedCount > 0 && <Button variant="outline" disabled={executing} onClick={() => {
          onSessionChange({ ...session, excluded: {} }); setSelected(new Set()); setFilter('all'); setIssueFilter(''); setPage(0)
        }}>恢复已移除的 {excludedCount} 条</Button>}
        <Button variant="outline" disabled={executing || !session.rules.length} onClick={() => setSaveOpen(true)}>保存标准值对照到方案</Button></div>
      {lastResults.filter((r) => r.sourceRow != null && remaining.some((record) => record.sourceRow === r.sourceRow)).map((r) => <p key={r.sourceRow} className="text-sm text-destructive">第 {r.sourceRow} 行上次执行失败：{r.reason}</p>)}
    </CardContent></Card>
    {groups.size > 0 && <Card><CardContent className="space-y-3 pt-5"><h2 className="font-medium">标准值对照</h2>
      {[...groups].map(([key, g]) => <div key={key} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
        <span>{fieldLabel(g.field, defs)}：<b>{g.from || '空值'}</b>（{g.rows.length} 行）</span>
        {Object.entries(g.when).map(([k, v]) => <span className="text-xs text-muted-foreground" key={k}>{fieldLabel(k, defs)}：{v || '未填写'}</span>)}
        <Select className="min-w-40" aria-label={`${fieldLabel(g.field, defs)} ${g.from} 对应标准值`} value={choices[key] ?? ''} onValueChange={(v) => setChoices({ ...choices, [key]: v })} options={g.options.map((v) => ({ value: v, label: v }))} placeholder="选择标准值" disabled={executing} />
        <Button size="sm" disabled={executing || !choices[key]} onClick={() => {
          const bulk = { ...session.bulk }; g.rows.forEach((row) => { bulk[row] = { ...bulk[row], [g.field]: choices[key] } })
          onSessionChange({ ...session, bulk, rules: [...session.rules, mappingRule(g.field, g.from, choices[key], g.when)] })
        }}>应用到这些行</Button>
        {!g.options.length && <span className="text-xs text-amber-700">请先修正上级字段或配置字典关联</span>}
        {g.field === 'purchasedProducts' && <span className="text-xs text-muted-foreground">需对应多个产品时，请逐行修正</span>}
      </div>)}
    </CardContent></Card>}
    <Card><CardContent className="space-y-3 pt-5">
      <div className="flex flex-wrap gap-2"><Select className="w-36" value={filter} onValueChange={(v) => { setFilter(v); setPage(0) }} options={[{ value: 'all', label: '全部剩余记录' }, { value: 'pending', label: '待处理' }, { value: 'ready', label: '可导入' }]} />
        <Select className="w-44" clearable clearLabel="全部问题" value={issueFilter} onValueChange={(v) => { setIssueFilter(v); setPage(0) }} options={[...new Set(rows.flatMap((r) => r.issues.map((i) => i.field)))].map((k) => ({ value: k, label: k === '_record' ? '记录冲突' : k.startsWith('source:') ? '原始单元格格式' : fieldLabel(k, defs) }))} />
        <Input className="w-52" aria-label="批量补齐客户名称" placeholder="填写或选择客户名称" list="import-customers" value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={255} disabled={executing} />
        <datalist id="import-customers">{customers.data?.map((c) => <option key={c.customerName} value={c.customerName} />)}</datalist>
        <Button variant="outline" disabled={executing || !customer.trim() || !selectedRows.length} onClick={() => {
          const bulk = { ...session.bulk }; selectedRows.forEach((r) => { bulk[r.sourceRow] = { ...bulk[r.sourceRow], customerName: customer.trim() } })
          onSessionChange({ ...session, bulk }); setSelected(new Set())
        }}>为所选 {selectedRows.length} 行填写客户</Button>
        <Button variant="destructive" disabled={executing || !selectedRows.length} onClick={() => {
          onSessionChange(excludeImportRows(session, selectedRows.map((row) => row.sourceRow)))
          setSelected(new Set()); setPage(0)
          toast.success(`已从本次导入清单移除 ${selectedRows.length} 条`)
        }}>删除所选 {selectedRows.length} 条</Button></div>
      <div className="overflow-auto rounded border"><Table><TableHeader><TableRow>
        <TableHead><input type="checkbox" aria-label="选择当前页未导入记录" disabled={executing || !pageRows.length} checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.sourceRow))} onChange={(e) => {
          const next = new Set(selected); pageRows.forEach((r) => e.target.checked ? next.add(r.sourceRow) : next.delete(r.sourceRow)); setSelected(next)
        }} /></TableHead><TableHead>Excel 行</TableHead><TableHead>状态</TableHead><TableHead>客户 / 项目</TableHead><TableHead>问题及修正</TableHead><TableHead>操作</TableHead>
      </TableRow></TableHeader><TableBody>{pageRows.map((r) => <TableRow key={r.sourceRow}>
        <TableCell><input type="checkbox" aria-label={`选择第 ${r.sourceRow} 行`} disabled={executing} checked={selected.has(r.sourceRow)} onChange={(e) => { const next = new Set(selected); if (e.target.checked) next.add(r.sourceRow); else next.delete(r.sourceRow); setSelected(next) }} /></TableCell>
        <TableCell>{r.sourceRow}</TableCell><TableCell>{r.ready ? (r.result?.status === 'added' ? '可新增' : '可覆盖') : currentPreview ? '待处理' : '待预检'}</TableCell>
        <TableCell className="min-w-40"><div>{r.result?.customerName || r.record.fields.customerName || '客户待补齐'}</div><div className="text-xs text-muted-foreground">{r.result?.projectName || r.record.fields.projectName || '项目待补齐'}</div>
          {!r.record.fields.customerName && r.result?.customerName && <div className="text-xs text-sky-700">沿用已有项目客户</div>}</TableCell>
        <TableCell className="min-w-56 max-w-lg whitespace-normal"><ul className="space-y-1 text-xs text-destructive">{r.issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>
          {Object.entries({ ...session.bulk[r.sourceRow], ...session.edits[r.sourceRow] }).map(([key, value]) => <div key={key} className="text-xs text-sky-700">{fieldLabel(key, defs)}：{valueText(fieldValue(originalByRow.get(r.sourceRow)?.fields ?? {}, key)) || '空'} → {valueText(value) || '空'}</div>)}</TableCell>
        <TableCell><Button size="sm" variant="outline" disabled={executing} onClick={() => setEditing(r.sourceRow)}>逐行修正</Button></TableCell>
      </TableRow>)}{pageRows.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{rows.length === 0 ? '本次导入清单已处理完成' : '没有符合筛选条件的记录'}</TableCell></TableRow>}</TableBody></Table></div>
      <div className="flex items-center justify-end gap-3 text-sm"><span>第 {pageIndex + 1} / {pageCount} 页，共 {shown.length} 行</span><Button variant="outline" size="sm" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>上一页</Button><Button variant="outline" size="sm" disabled={pageIndex >= pageCount - 1} onClick={() => setPage(pageIndex + 1)}>下一页</Button></div>
    </CardContent></Card>
    <div className="flex justify-between"><Button variant="outline" disabled={executing} onClick={onBack}>返回映射调整</Button><div className="flex gap-2"><Button variant="outline" disabled={executing} onClick={onReset}>重新上传</Button><Button disabled={executing || uncertain || !currentPreview || !ready.length || Boolean(previewError)} onClick={() => setConfirmOpen(true)}>导入已通过的 {ready.length} 条</Button></div></div>
    {editingRow && editingBase && <ImportRowEditor key={editingRow.sourceRow} record={editingBase} edits={session.edits[editingRow.sourceRow] ?? {}} cells={session.cells[editingRow.sourceRow] ?? {}}
      headers={parsed.headers} original={parsed.rows[editingRow.sourceRow - parsed.dataStartRow]} defs={defs} dictionaries={dictionaries.data ?? []} onClose={() => setEditing(null)}
      onSave={(edits, cells) => { onSessionChange({ ...session, edits: { ...session.edits, [editingRow.sourceRow]: edits }, cells: { ...session.cells, [editingRow.sourceRow]: cells } }); setEditing(null) }} />}
    <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="确认分批导入" description={`本次新增 ${ready.filter((r) => r.result?.status === 'added').length} 条、覆盖 ${ready.filter((r) => r.result?.status === 'overwritten').length} 条；另有 ${unresolved.length} 条待处理，将保留在当前页面。仅本次需要的新增字段会被创建。`} confirmText="确认导入已通过记录" loading={executing} onConfirm={() => void runImport()} />
    <SaveNameDialog open={saveOpen} onOpenChange={setSaveOpen} title="保存标准值对照" description="保存字段映射和值对照；本次补客户和单行修改不会保存为通用规则。" nameLabel="方案名称" defaultName={mappingName} loading={mappings.create.isPending || mappings.update.isPending} onSubmit={(name) => void saveRules(name).catch(() => {})} />
  </div>
}
