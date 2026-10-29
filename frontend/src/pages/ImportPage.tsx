import { useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ID, ImportMapping } from '@/types'
import type { ParsedSheet } from '@/components/impexp/excel'
import { StepUpload } from '@/components/impexp/StepUpload'
import { StepMapping } from '@/components/impexp/StepMapping'
import { StepConfirm } from '@/components/impexp/StepConfirm'
import {
  buildColumnMap,
  draftsToRules,
  rulesToDrafts,
  targetsFromColumnMap,
} from '@/components/impexp/importTransform'
import { autoMapColumns, pendingFieldsFromTargets } from '@/components/impexp/autoMapping'
import type { ColumnTarget, RuleDraft } from '@/components/impexp/importTransform'
import { useCustomFieldDefs } from '@/hooks/queries'
import { emptyReview, isPendingImportRow } from '@/components/impexp/importReview'

const STEPS = ['上传解析', '映射调整', '确认执行']

export default function ImportPage() {
  const [step, setStep] = useState(1)
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [targets, setTargets] = useState<ColumnTarget[]>([])
  const [ruleDrafts, setRuleDrafts] = useState<RuleDraft[]>([])
  const [mappingId, setMappingId] = useState<ID | null>(null)
  const [mappingName, setMappingName] = useState('')
  const [session, setSession] = useState(emptyReview)
  const [uploadVersion, setUploadVersion] = useState(0)
  const [defaultYear, setDefaultYear] = useState('')
  const [sourceTrack, setSourceTrack] = useState('')
  const customDefsQ = useCustomFieldDefs()
  const hasPending = parsed != null && parsed.rows.some((row, index) => row.some((cell) => cell.trim()) && isPendingImportRow(session, parsed.dataStartRow + index))
  const blocker = useBlocker(hasPending)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('还有未导入记录。建议先下载待处理清单；离开将丢失本次修正进度。仍要离开？')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!hasPending) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [hasPending])

  const columnMap = useMemo(
    () => (parsed ? buildColumnMap(parsed.headers, targets) : {}),
    [parsed, targets],
  )
  const valueRules = useMemo(() => [...draftsToRules(ruleDrafts), ...(sourceTrack ? [{ type: 'default' as const, field: 'track', value: sourceTrack }] : [])], [ruleDrafts, sourceTrack])
  const pendingFields = useMemo(() => pendingFieldsFromTargets(targets), [targets])

  const handleParsed = async (p: ParsedSheet) => {
    if (hasPending && !window.confirm('重新上传会清除本次修正进度，请确认已下载需要保留的清单。继续？')) return
    let customDefs = customDefsQ.data
    if (!customDefs) {
      const refreshed = await customDefsQ.refetch()
      if (refreshed.error) throw refreshed.error
      customDefs = refreshed.data ?? []
    }
    setParsed(p)
    setSession(emptyReview())
    setUploadVersion((v) => v + 1)
    setTargets(autoMapColumns(p.headers, p.rows, customDefs))
    setRuleDrafts([])
    setMappingId(null)
    setMappingName('')
  }

  const applyMapping = (m: ImportMapping) => {
    if (!parsed) return
    setMappingId(m.id)
    setMappingName(m.name)
    setSourceTrack(m.applicableTrack ?? '')
    const mapped = targetsFromColumnMap(parsed.headers, m.columnMap)
    if (m.name === '公有云需求洞察（固定语义）') {
      const automatic = autoMapColumns(parsed.headers, parsed.rows, customDefsQ.data ?? [])
      parsed.headers.forEach((header, index) => { if (!Object.hasOwn(m.columnMap, header)) mapped[index] = automatic[index] })
    }
    setTargets(mapped)
    setRuleDrafts(rulesToDrafts(m.valueRules))
  }

  const resetAll = () => {
    if (hasPending && !window.confirm('还有待处理记录，建议先下载清单。确定清除本次导入进度？')) return
    setStep(1)
    setParsed(null)
    setTargets([])
    setRuleDrafts([])
    setMappingId(null)
    setMappingName('')
    setSession(emptyReview())
  }

  const goStep = (s: number) => {
    setStep(s)
  }

  return (
    <div className="page-shell page-shell-form">
      <div className="page-heading">
        <h1 className="text-lg font-semibold">Excel 导入向导</h1>
        <p className="text-sm text-muted-foreground">上传 → 映射调整 → 确认执行，三步完成；文件在本地解析，不经过服务器</p>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-[12rem_12rem_minmax(0,1fr)] lg:items-end">
        <div className="filter-field"><Label htmlFor="import-track">本次导入赛道</Label><Select id="import-track" value={sourceTrack} onValueChange={setSourceTrack} clearable clearLabel="未指定" placeholder="未指定" options={['HCS', '公有云'].map((v) => ({ value: v, label: v }))} /></div>
        <div className="filter-field"><Label htmlFor="progress-default-year">进展默认年份</Label>
        <Input id="progress-default-year" type="number" min={1000} max={9999} placeholder="如 2025" value={defaultYear} onChange={(event) => setDefaultYear(event.target.value)} /></div>
        <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2 lg:col-span-1">仅用于“9月13日、09/13”等缺少年份的日期；不填写时此类记录待修正，不使用导入当天。</p>
      </div>

      {/* 步骤条 */}
      <div aria-label="导入步骤" className="flex items-start justify-between gap-2 rounded-xl border bg-card p-4 sm:justify-start sm:gap-4">
        {STEPS.map((label, i) => {
          const n = i + 1
          const active = n === step
          const done = n < step
          return (
            <div key={label} aria-current={active ? 'step' : undefined} className="flex min-w-0 items-center gap-4">
              {i > 0 && <div className={cn('hidden h-px w-10 shrink-0 sm:block lg:w-16', done || active ? 'bg-primary/50' : 'bg-border')} />}
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium',
                    active && 'border-primary bg-primary text-primary-foreground',
                    done && 'border-primary/50 bg-primary/10 text-primary',
                    !active && !done && 'text-muted-foreground',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <span className={cn('whitespace-nowrap text-xs sm:text-sm', active ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {step === 1 && <StepUpload parsed={parsed} onParsed={handleParsed} onNext={() => goStep(2)} />}

      {step === 2 && parsed && (
        <StepMapping
          parsed={parsed}
          targets={targets}
          onTargetsChange={setTargets}
          ruleDrafts={ruleDrafts}
          onRuleDraftsChange={setRuleDrafts}
          mappingId={mappingId}
          mappingName={mappingName}
          sourceTrack={sourceTrack}
          onApplyMapping={applyMapping}
          onMappingSaved={(id, name) => {
            setMappingId(id)
            setMappingName(name)
          }}
          onClearMapping={() => {
            setMappingId(null)
            setMappingName('')
            setTargets(autoMapColumns(parsed.headers, parsed.rows, customDefsQ.data ?? []))
          }}
          onBack={() => setStep(1)}
          onNext={() => goStep(3)}
        />
      )}

      {parsed && <div hidden={step !== 3}>
        <StepConfirm
          key={uploadVersion}
          active={step === 3}
          session={session}
          onSessionChange={setSession}
          mappingName={mappingName}
          onMappingSaved={(id, name, rules) => {
            setMappingId(id); setMappingName(name); setRuleDrafts(rulesToDrafts(rules))
            setSession((current) => ({ ...current, rules: [] }))
          }}
          parsed={parsed}
          columnMap={columnMap}
          valueRules={valueRules}
          mappingId={mappingId}
          pendingFields={pendingFields}
          defaultYear={/^\d{4}$/.test(defaultYear) && Number(defaultYear) >= 1000 ? Number(defaultYear) : undefined}
          onBack={() => setStep(2)}
          onReset={resetAll}
        />
      </div>}
    </div>
  )
}
