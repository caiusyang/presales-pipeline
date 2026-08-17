import { useEffect, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useImportRecords } from '@/hooks/queries'
import type { ID, ValueRule } from '@/types'
import type { ImportResult } from '@/api/types'
import type { ParsedSheet } from './excel'
import { buildImportRecords } from './importTransform'
import { ImportResultView } from './ImportResultView'

interface Props {
  parsed: ParsedSheet
  columnMap: Record<string, string>
  valueRules: ValueRule[]
  mappingId: ID | null
  onBack: () => void
  onReset: () => void
}

/** 导入第 3 步：组装记录 → dryRun 预检 → 确认执行 → 展示结果 */
export function StepConfirm({ parsed, columnMap, valueRules, mappingId, onBack, onReset }: Props) {
  const importMut = useImportRecords()
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const { records, problems } = useMemo(
    () =>
      buildImportRecords({
        headers: parsed.headers,
        rows: parsed.rows,
        columnMap,
        valueRules,
        today,
      }),
    [parsed, columnMap, valueRules, today],
  )

  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [finalResult, setFinalResult] = useState<ImportResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ranRef = useRef(false)

  const runDry = async () => {
    setPreview(null)
    try {
      const r = await importMut.mutateAsync({ mappingId, dryRun: true, records })
      setPreview(r)
    } catch {
      // 错误提示由 hook 统一 toast
    }
  }

  // 进入本步自动预检（ranRef 防止重复触发）
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    void runDry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runImport = async () => {
    try {
      const r = await importMut.mutateAsync({ mappingId, dryRun: false, records })
      setFinalResult(r)
      setConfirmOpen(false)
      toast.success(`导入完成：新增 ${r.added} / 覆盖 ${r.overwritten} / 跳过 ${r.skipped}`)
    } catch {
      // 错误提示由 hook 统一 toast
    }
  }

  if (finalResult) {
    return (
      <div className="space-y-4">
        <ImportResultView result={finalResult} title="执行结果" />
        <div className="flex justify-end">
          <Button variant="outline" onClick={onReset}>
            <RefreshCw /> 再导入一批
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-sm sm:pt-5">
          <span>
            待导入记录 <b>{records.length}</b> 条
          </span>
          <span className="text-muted-foreground">映射列 {Object.keys(columnMap).length} 个</span>
          <span className="text-muted-foreground">值映射规则 {valueRules.length} 条</span>
          {mappingId != null && <span className="text-muted-foreground">将关联当前映射方案</span>}
        </CardContent>
      </Card>

      {problems.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="space-y-1.5 pt-4 sm:pt-5">
            <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" /> 前端预检发现 {problems.length} 条问题（对应行可能被跳过或部分忽略）
            </div>
            <div className="max-h-40 space-y-1 overflow-auto text-xs text-amber-700">
              {problems.slice(0, 100).map((p, i) => (
                <div key={i}>
                  第 {p.excelRow} 行：{p.message}
                </div>
              ))}
              {problems.length > 100 && <div>… 其余 {problems.length - 100} 条省略</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {preview ? (
        <ImportResultView result={preview} title="预检结果（dryRun，未写入）" />
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-4 sm:pt-5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-48 w-full" />
            <div className="text-center text-xs text-muted-foreground">正在预检…</div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft /> 上一步
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void runDry()} disabled={importMut.isPending}>
            <RefreshCw /> 重新预检
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={!preview || importMut.isPending || records.length === 0}>
            <UploadCloud /> 执行导入
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="确认执行导入"
        description={
          preview
            ? `预检结果：新增 ${preview.added} 条、覆盖 ${preview.overwritten} 条、跳过 ${preview.skipped} 条。执行后将正式写入平台，确认继续？`
            : '确认执行导入？'
        }
        confirmText="确认导入"
        loading={importMut.isPending}
        onConfirm={() => void runImport()}
      />

      {preview && preview.added + preview.overwritten > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          覆盖语义：按外部编号或「客户+项目」判重，命中时仅更新本次出现的字段
        </div>
      )}
    </div>
  )
}
