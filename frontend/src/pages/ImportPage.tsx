import { useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Check } from 'lucide-react'
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
import { emptyReview } from '@/components/impexp/importReview'

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
  const customDefsQ = useCustomFieldDefs()
  const hasPending = parsed != null && parsed.rows.some((row, index) => row.some((cell) => cell.trim()) && !session.completed[parsed.dataStartRow + index])
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
  const valueRules = useMemo(() => draftsToRules(ruleDrafts), [ruleDrafts])
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
    setTargets(targetsFromColumnMap(parsed.headers, m.columnMap))
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
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Excel 导入向导</h1>
        <p className="text-sm text-muted-foreground">上传 → 映射调整 → 确认执行，三步完成；文件在本地解析，不经过服务器</p>
      </div>

      {/* 步骤条 */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1
          const active = n === step
          const done = n < step
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={cn('h-px w-10 sm:w-16', done || active ? 'bg-primary/50' : 'bg-border')} />}
              <div className="flex items-center gap-2">
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
                <span className={cn('text-sm', active ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
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
          onBack={() => setStep(2)}
          onReset={resetAll}
        />
      </div>}
    </div>
  )
}
