import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { Download, Eye, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDictionaries, useExportData, useExportFields, useExportTemplates, useTemplateMutations } from '@/hooks/queries'
import { flattenDictTree } from '@/lib/fields'
import type { ExportColumn, ExportScope, ID } from '@/types'
import type { ExportFilters, ExportResult } from '@/api/types'
import { cellToString, downloadExportXlsx } from '@/components/impexp/excel'
import { ExportColumnConfig } from '@/components/impexp/ExportColumnConfig'
import { SaveNameDialog } from '@/components/impexp/SaveNameDialog'

const SCOPE_LABELS: Record<ExportScope, string> = {
  projects: '项目主表',
  revenues: '收入明细',
  progress: '进展日志',
}

const PREVIEW_ROWS = 20

interface FilterState {
  industry: string
  track: string
  keyword: string
  startMonth: string
  endMonth: string
}

const EMPTY_FILTERS: FilterState = { industry: '', track: '', keyword: '', startMonth: '', endMonth: '' }

export default function ExportPage() {
  const [scope, setScope] = useState<ExportScope>('projects')
  const [templateId, setTemplateId] = useState<ID | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [columns, setColumns] = useState<ExportColumn[]>([])
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [preview, setPreview] = useState<ExportResult | null>(null)
  const [previewKey, setPreviewKey] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const templates = useExportTemplates()
  const templateMut = useTemplateMutations()
  const fieldsQuery = useExportFields(scope)
  const exportMut = useExportData()
  const industryDict = useDictionaries(scope === 'projects' ? 'industry' : undefined)
  const trackDict = useDictionaries(scope === 'projects' ? 'track' : undefined)

  const scopeTemplates = useMemo(
    () => (templates.data ?? []).filter((t) => t.scope === scope),
    [templates.data, scope],
  )

  const dictOptions = (nodes: typeof industryDict.data) =>
    flattenDictTree(nodes ?? []).map((n) => ({ value: n.value, label: n.value }))

  /** 组装 filters（去掉空值；月份区间仅影响 projects 的 revenueTotal 期间汇总，revenues/progress 按区间过滤） */
  const buildFilters = (): ExportFilters => {
    const f: ExportFilters = {}
    if (scope === 'projects') {
      if (filters.industry) f.industry = filters.industry
      if (filters.track) f.track = filters.track
      if (filters.keyword.trim()) f.keyword = filters.keyword.trim()
    }
    if (filters.startMonth) f.startMonth = filters.startMonth
    if (filters.endMonth) f.endMonth = filters.endMonth
    return f
  }

  const paramsKey = () => JSON.stringify({ scope, columns, filters: buildFilters() })

  const handleScopeChange = (v: string) => {
    setScope(v as ExportScope)
    setTemplateId(null)
    setTemplateName('')
    setColumns([])
    setFilters(EMPTY_FILTERS)
    setPreview(null)
  }

  const handleSelectTemplate = (v: string) => {
    if (!v) {
      setTemplateId(null)
      setTemplateName('')
      return
    }
    const t = scopeTemplates.find((x) => String(x.id) === v)
    if (t) {
      setTemplateId(t.id)
      setTemplateName(t.name)
      setColumns(t.columns.map((c) => ({ ...c })))
      setPreview(null)
      toast.success(`已载入模板「${t.name}」`)
    }
  }

  const handleSaveTemplate = async (name: string) => {
    if (!columns.length) {
      toast.error('请至少选择一列再保存模板')
      return
    }
    setSaving(true)
    try {
      if (templateId != null) {
        await templateMut.update.mutateAsync({ id: templateId, input: { name, scope, columns } })
        setTemplateName(name)
      } else {
        const created = await templateMut.create.mutateAsync({ name, scope, columns })
        setTemplateId(created.id)
        setTemplateName(created.name)
      }
      setSaveOpen(false)
    } catch {
      // 错误提示由 hook 统一 toast
    } finally {
      setSaving(false)
    }
  }

  const requestData = () =>
    exportMut.mutateAsync({ scope, columns, filters: buildFilters() })

  const handlePreview = async () => {
    if (!columns.length) {
      toast.error('请至少选择一列')
      return
    }
    try {
      const res = await requestData()
      setPreview(res)
      setPreviewKey(paramsKey())
    } catch {
      // 错误提示由 hook 统一 toast
    }
  }

  const handleDownload = async () => {
    if (!columns.length) {
      toast.error('请至少选择一列')
      return
    }
    try {
      // 预览数据未过期则复用，否则重新请求全量
      const res = preview && previewKey === paramsKey() ? preview : await requestData()
      const filename = `售前导出_${SCOPE_LABELS[res.scope]}_${dayjs().format('YYYY-MM-DD')}.xlsx`
      downloadExportXlsx(res.columns, res.rows, SCOPE_LABELS[res.scope], filename)
      toast.success(`已导出 ${res.totalRows} 行：${filename}`)
    } catch {
      // 错误提示由 hook 统一 toast
    }
  }

  const loading = exportMut.isPending

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Excel 导出</h1>
        <p className="text-sm text-muted-foreground">按模板或临时选列导出快照，列名/列顺序完全自定义，拿来即用</p>
      </div>

      <Tabs value={scope} onValueChange={handleScopeChange}>
        <TabsList>
          <TabsTrigger value="projects">项目主表</TabsTrigger>
          <TabsTrigger value="revenues">收入明细</TabsTrigger>
          <TabsTrigger value="progress">进展日志</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">导出模板</CardTitle>
          <CardDescription>载入模板自动填充列配置，调整后也可另存覆盖</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {templates.isLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <Select
              className="w-64"
              value={templateId != null ? String(templateId) : ''}
              onValueChange={handleSelectTemplate}
              options={scopeTemplates.map((t) => ({ value: String(t.id), label: t.name }))}
              placeholder={scopeTemplates.length ? '选择模板' : '该范围暂无模板'}
              clearable
              clearLabel="不使用模板"
            />
          )}
          {templateId != null && <Badge variant="info">当前模板：{templateName}</Badge>}
          <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!columns.length}>
            <Save /> 另存为模板
          </Button>
        </CardContent>
      </Card>

      {fieldsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <ExportColumnConfig
          fields={fieldsQuery.data ?? []}
          columns={columns}
          onChange={(cols) => {
            setColumns(cols)
            setPreview(null)
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
          {scope === 'projects' && (
            <CardDescription>月份区间为可选，填写后「累计收入」按该期间汇总</CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {scope === 'projects' && (
            <>
              <div className="space-y-1.5">
                <Label>行业</Label>
                <Select
                  value={filters.industry}
                  onValueChange={(v) => setFilters({ ...filters, industry: v })}
                  options={dictOptions(industryDict.data)}
                  placeholder="全部行业"
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label>赛道</Label>
                <Select
                  value={filters.track}
                  onValueChange={(v) => setFilters({ ...filters, track: v })}
                  options={dictOptions(trackDict.data)}
                  placeholder="全部赛道"
                  clearable
                />
              </div>
              <div className="space-y-1.5">
                <Label>关键字</Label>
                <Input
                  value={filters.keyword}
                  onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                  placeholder="客户 / 项目名称"
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>起始月份</Label>
            <Input
              type="month"
              value={filters.startMonth}
              onChange={(e) => setFilters({ ...filters, startMonth: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>结束月份</Label>
            <Input
              type="month"
              value={filters.endMonth}
              onChange={(e) => setFilters({ ...filters, endMonth: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => void handlePreview()} disabled={!columns.length || loading}>
          <Eye /> 预览
        </Button>
        <Button onClick={() => void handleDownload()} disabled={!columns.length || loading}>
          <Download /> {loading ? '请求中…' : '下载 xlsx'}
        </Button>
        {!columns.length && <span className="text-xs text-muted-foreground">请先至少选择一列</span>}
      </div>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              预览 <Badge variant="secondary">共 {preview.totalRows} 行</Badge>
            </CardTitle>
            <CardDescription>仅展示前 {PREVIEW_ROWS} 行，下载文件包含全部数据</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    {preview.columns.map((c) => (
                      <TableHead key={c.key} className="font-semibold text-foreground">
                        {c.title}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <TableRow key={i}>
                      {preview.columns.map((c) => (
                        <TableCell key={c.key} className="max-w-56 truncate whitespace-nowrap" title={cellToString(row[c.key])}>
                          {cellToString(row[c.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {preview.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={preview.columns.length} className="py-10 text-center text-muted-foreground">
                        当前筛选条件下没有数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <SaveNameDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="另存为导出模板"
        description={templateId != null ? '将覆盖当前已载入的模板配置' : '保存后可在下次导出时一键载入'}
        nameLabel="模板名称"
        defaultName={templateName}
        loading={saving}
        onSubmit={(name) => void handleSaveTemplate(name)}
      />
    </div>
  )
}
