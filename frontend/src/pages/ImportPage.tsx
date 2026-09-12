import { useMemo, useState } from 'react'
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

const STEPS = ['上传解析', '映射调整', '确认执行']

export default function ImportPage() {
  const [step, setStep] = useState(1)
  const [parsed, setParsed] = useState<ParsedSheet | null>(null)
  const [targets, setTargets] = useState<ColumnTarget[]>([])
  const [ruleDrafts, setRuleDrafts] = useState<RuleDraft[]>([])
  const [mappingId, setMappingId] = useState<ID | null>(null)
  const [mappingName, setMappingName] = useState('')
  // step 变化时重置 StepConfirm 内部状态（重新预检）
  const [confirmKey, setConfirmKey] = useState(0)
  const customDefsQ = useCustomFieldDefs()

  const columnMap = useMemo(
    () => (parsed ? buildColumnMap(parsed.headers, targets) : {}),
    [parsed, targets],
  )
  const valueRules = useMemo(() => draftsToRules(ruleDrafts), [ruleDrafts])
  const pendingFields = useMemo(() => pendingFieldsFromTargets(targets), [targets])

  const handleParsed = async (p: ParsedSheet) => {
    let customDefs = customDefsQ.data
    if (!customDefs) {
      const refreshed = await customDefsQ.refetch()
      if (refreshed.error) throw refreshed.error
      customDefs = refreshed.data ?? []
    }
    setParsed(p)
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
    setStep(1)
    setParsed(null)
    setTargets([])
    setRuleDrafts([])
    setMappingId(null)
    setMappingName('')
  }

  const goStep = (s: number) => {
    if (s === 3) setConfirmKey((k) => k + 1)
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

      {step === 3 && parsed && (
        <StepConfirm
          key={confirmKey}
          parsed={parsed}
          columnMap={columnMap}
          valueRules={valueRules}
          mappingId={mappingId}
          pendingFields={pendingFields}
          onBack={() => setStep(2)}
          onReset={resetAll}
        />
      )}
    </div>
  )
}
