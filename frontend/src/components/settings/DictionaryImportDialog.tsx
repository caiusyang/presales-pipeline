import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { MAX_IMPORT_FILE_BYTES, parseExcelFile, type ParsedSheet } from '@/components/impexp/excel'
import { useImportDictionaryValues } from '@/hooks/queries'
import {
  defaultDictionaryValueColumn,
  dictionaryRecordsFromPaste,
  dictionaryRecordsFromSheet,
  MAX_DICTIONARY_IMPORT_ROWS,
} from './dictionaryImport'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: { type: string; parentId: number | null; label: string } | null
}

const PAGE_SIZE = 50
const STATUS_LABELS = { added: '可导入', skipped: '跳过', failed: '失败' } as const

export function DictionaryImportDialog({ open, onOpenChange, target }: Props) {
  const importValues = useImportDictionaryValues()
  type ImportReport = Awaited<ReturnType<typeof importValues.mutateAsync>>
  const [mode, setMode] = useState('file')
  const [paste, setPaste] = useState('')
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [fileName, setFileName] = useState('')
  const [column, setColumn] = useState(-1)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState('')
  const [operation, setOperation] = useState<'parsing' | 'preview' | 'import' | null>(null)
  const [completed, setCompleted] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const requestVersion = useRef(0)
  const targetKey = target ? `${target.type}:${target.parentId ?? 'root'}` : ''
  const busy = operation !== null

  useEffect(() => {
    requestVersion.current += 1
    setMode('file')
    setPaste('')
    setSheet(null)
    setFileName('')
    setColumn(-1)
    setReport(null)
    setError('')
    setOperation(null)
    setCompleted(false)
    setStatusFilter('all')
    setPage(0)
  }, [open, targetKey])

  const input = useMemo(() => {
    try {
      const records = mode === 'paste'
        ? dictionaryRecordsFromPaste(paste)
        : sheet ? dictionaryRecordsFromSheet(sheet, column) : []
      return { records, error: '' }
    } catch (e) {
      return { records: [], error: (e as Error).message }
    }
  }, [mode, paste, sheet, column])

  const invalidatePreview = () => {
    requestVersion.current += 1
    setReport(null)
    setError('')
    setCompleted(false)
    setStatusFilter('all')
    setPage(0)
  }

  const handleFile = async (file: File) => {
    invalidatePreview()
    const version = requestVersion.current
    setOperation('parsing')
    try {
      const parsed = await parseExcelFile(file)
      if (version !== requestVersion.current) return
      setSheet(parsed)
      setFileName(file.name)
      setColumn(defaultDictionaryValueColumn(parsed.headers))
    } catch (e) {
      if (version === requestVersion.current) setError(`文件解析失败：${(e as Error).message || '无法读取文件'}`)
    } finally {
      if (version === requestVersion.current) setOperation(null)
    }
  }

  const submit = async (dryRun: boolean) => {
    if (!target || busy || input.error || !input.records.length || completed) return
    if (!dryRun && (!report?.dryRun || report.added === 0)) return
    const version = requestVersion.current
    setOperation(dryRun ? 'preview' : 'import')
    setError('')
    try {
      const result = await importValues.mutateAsync({
        type: target.type,
        parentId: target.parentId,
        dryRun,
        records: input.records,
      })
      if (version !== requestVersion.current) return
      setReport(result)
      setStatusFilter('all')
      setPage(0)
      setCompleted(!dryRun)
    } catch (e) {
      if (version === requestVersion.current) {
        setError(`${dryRun ? '预检' : '导入'}失败：${(e as Error).message || '请稍后重试'}。输入内容已保留。`)
      }
    } finally {
      if (version === requestVersion.current) setOperation(null)
    }
  }

  const filteredDetails = (report?.details ?? []).filter((detail) => statusFilter === 'all' || detail.status === statusFilter)
  const totalPages = Math.max(1, Math.ceil(filteredDetails.length / PAGE_SIZE))
  const visibleDetails = filteredDetails.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (operation !== 'import') onOpenChange(next) }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>导入字典值</DialogTitle>
          <DialogDescription>
            目标：{target?.label ?? '未选择字典'}。先预检，确认后才新增；重复值（忽略大小写）自动跳过，不覆盖现有字典值。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(next) => { if (!busy) { invalidatePreview(); setMode(next) } }}>
          <TabsList>
            <TabsTrigger value="file" disabled={busy}>Excel / CSV 文件</TabsTrigger>
            <TabsTrigger value="paste" disabled={busy}>多行粘贴</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                aria-label="上传字典值文件"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFile(file)
                  event.target.value = ''
                }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload />{operation === 'parsing' ? '解析中…' : sheet ? '重新选择文件' : '选择文件'}
              </Button>
              <span className="text-xs text-muted-foreground">支持 .xlsx / .xls / .csv，最大 {MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB；仅读取首个工作表</span>
            </div>
            {sheet && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-4 w-4 shrink-0" /><span className="break-all">{fileName} · {sheet.sheetName}</span></div>
                <Label htmlFor="dictionary-value-column">字典值所在列</Label>
                <Select
                  id="dictionary-value-column"
                  value={column >= 0 ? String(column) : ''}
                  onValueChange={(next) => { invalidatePreview(); setColumn(Number(next)) }}
                  options={sheet.headers.map((header, index) => ({ value: String(index), label: `${index + 1}. ${header}` }))}
                  placeholder="请选择要导入的列"
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">识别 {sheet.headerRows} 行表头；报告显示原始 Excel / CSV 行号，只导入当前选择的这一列。</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="paste" className="space-y-2">
            <Label htmlFor="dictionary-value-paste">每行一个字典值</Label>
            <Textarea
              id="dictionary-value-paste"
              value={paste}
              onChange={(event) => { invalidatePreview(); setPaste(event.target.value) }}
              disabled={busy}
              rows={7}
              placeholder={'例如：\n华东\n华南\n华北'}
            />
            <p className="text-xs text-muted-foreground">自动去除首尾空格并忽略空行；重复项不会被重复新增。</p>
          </TabsContent>
        </Tabs>

        <div className="text-sm text-muted-foreground" aria-live="polite">当前读取 {input.records.length} 个非空值，每次最多 {MAX_DICTIONARY_IMPORT_ROWS} 个。</div>
        {(error || input.error) && (
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error || input.error}</span>
          </div>
        )}

        {report ? (
          <div className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{report.dryRun ? '预检结果（尚未写入）' : '导入结果'}</span>
              <Badge variant="success">{report.dryRun ? '可导入' : '已新增'} {report.added}</Badge>
              <Badge variant="warning">跳过 {report.skipped}</Badge>
              <Badge variant="destructive">失败 {report.failed}</Badge>
            </div>
            {completed && (
              <div className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>本批次已处理，不会重复提交。可修改输入内容或重新选择文件，再开始新一轮预检。</span>
              </div>
            )}
            {report.failed > 0 && <p className="text-sm text-muted-foreground">失败项不会新增，可根据下方原因调整；确认导入时只新增通过校验的值。</p>}
            <Select
              aria-label="筛选字典导入结果"
              value={statusFilter}
              onValueChange={(next) => { setStatusFilter(next); setPage(0) }}
              options={[
                { value: 'all', label: '全部结果' },
                { value: 'added', label: report.dryRun ? '仅可导入' : '仅已新增' },
                { value: 'skipped', label: '仅跳过' },
                { value: 'failed', label: '仅失败' },
              ]}
            />
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead className="w-16">源行号</TableHead><TableHead>字典值</TableHead><TableHead className="w-20">状态</TableHead><TableHead>说明</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visibleDetails.map((detail, index) => (
                    <TableRow key={`${detail.sourceRow}-${index}`}>
                      <TableCell className="align-top tabular-nums">{detail.sourceRow}</TableCell>
                      <TableCell className="max-w-64 align-top"><span className="line-clamp-3 break-all whitespace-pre-wrap" title={detail.value}>{detail.value}</span></TableCell>
                      <TableCell className="align-top"><Badge variant={detail.status === 'added' ? 'success' : detail.status === 'skipped' ? 'warning' : 'destructive'}>{detail.status === 'added' && !report.dryRun ? '已新增' : STATUS_LABELS[detail.status]}</Badge></TableCell>
                      <TableCell className="max-w-72 align-top whitespace-normal text-xs text-muted-foreground">{detail.reason || (detail.status === 'added' ? report.dryRun ? '确认后新增' : '新增成功' : '—')}</TableCell>
                    </TableRow>
                  ))}
                  {visibleDetails.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">当前筛选下没有记录</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            {filteredDetails.length > PAGE_SIZE && (
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                <span>共 {filteredDetails.length} 条，第 {page + 1} / {totalPages} 页</span>
                <Button variant="outline" size="xs" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>上一页</Button>
                <Button variant="outline" size="xs" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>下一页</Button>
              </div>
            )}
          </div>
        ) : input.records.length > 0 && (
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            <div className="mb-2 font-medium text-foreground">待预检内容（前 10 个）</div>
            <div className="space-y-1">{input.records.slice(0, 10).map((record) => <div key={record.sourceRow} className="flex gap-3"><span className="w-12 shrink-0">第 {record.sourceRow} 行</span><span className="break-all whitespace-pre-wrap">{record.value}</span></div>)}</div>
          </div>
        )}

        <DialogFooter className="flex-wrap">
          <Button variant="outline" disabled={operation === 'import'} onClick={() => onOpenChange(false)}>{completed ? '完成' : '取消'}</Button>
          {!completed && (
            <Button variant="outline" disabled={busy || !target || !!input.error || input.records.length === 0} onClick={() => void submit(true)}>
              {operation === 'preview' ? '预检中…' : report ? '重新预检' : '预检字典值'}
            </Button>
          )}
          {!completed && report?.dryRun && (
            <Button disabled={busy || report.added === 0 || !!input.error} onClick={() => void submit(false)}>
              {operation === 'import' ? '导入中…' : `确认导入 ${report.added} 条`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
