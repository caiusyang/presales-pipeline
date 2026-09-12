import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ProjectFormFields } from '@/components/project/ProjectFormFields'
import {
  changeLogFieldLabel,
  changeLogSourceLabel,
  normalizeForSubmit,
  projectToInput,
  validateProjectInput,
} from '@/components/project/project-utils'
import {
  useCustomFieldDefs,
  useProgressMutations,
  useProjectDetail,
  useProjectMutations,
  useSaveRevenues,
} from '@/hooks/queries'
import { fmtAmount, isValidMonth } from '@/lib/format'
import { PRODUCT_CATALOG } from '@/lib/products'
import { cn } from '@/lib/utils'
import type {
  ChangeLog,
  CustomFieldDef,
  ID,
  ProgressLog,
  Project,
  ProjectInput,
  ProjectProductRecord,
  Revenue,
} from '@/types'

interface Props {
  projectId: ID | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 项目详情抽屉：概览 / 进展时间线 / 按月收入 / 修改日志 */
export function ProjectDetailDrawer({ projectId, open, onOpenChange }: Props) {
  const { data, isLoading } = useProjectDetail(open ? projectId : null)
  const customDefsQ = useCustomFieldDefs()
  const project = data?.project

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{project ? `${project.customerName} · ${project.projectName}` : '项目详情'}</DrawerTitle>
          <DrawerDescription className="sr-only">项目详情与收入、进展、修改日志</DrawerDescription>
          {project && (
            <div className="mt-2">
              <Badge variant="success">累计收入 {fmtAmount(project.revenueTotal)} 万元</Badge>
            </div>
          )}
        </DrawerHeader>
        <DrawerBody>
          {isLoading || !data || !project ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">概览</TabsTrigger>
                <TabsTrigger value="progress">进展时间线</TabsTrigger>
                <TabsTrigger value="products">产品拥有情况</TabsTrigger>
                <TabsTrigger value="revenue">按月收入</TabsTrigger>
                <TabsTrigger value="logs">修改日志</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <OverviewTab key={project.id} project={project} customDefs={customDefsQ.data ?? []} />
              </TabsContent>
              <TabsContent value="progress">
                <ProgressTab projectId={project.id} logs={data.progress} />
              </TabsContent>
              <TabsContent value="products">
                <ProductsTab records={data.products ?? []} />
              </TabsContent>
              <TabsContent value="revenue">
                <RevenueTab projectId={project.id} revenues={data.revenues} />
              </TabsContent>
              <TabsContent value="logs">
                <ChangeLogTab logs={data.changeLogs} customDefs={customDefsQ.data ?? []} />
              </TabsContent>
            </Tabs>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}

// ---------------- 产品拥有情况 ----------------

function ProductsTab({ records }: { records: ProjectProductRecord[] }) {
  const byCode = new Map(records.map((record) => [record.productCode.toLowerCase(), record]))
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        产品目录固定为 9 项。已购产品会在项目产品关系表中保存独立记录。
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>产品</TableHead>
              <TableHead>拥有情况</TableHead>
              <TableHead>记录时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PRODUCT_CATALOG.map((product) => {
              const record = byCode.get(product.toLowerCase())
              return (
                <TableRow key={product}>
                  <TableCell className="font-medium">{product}</TableCell>
                  <TableCell>
                    <Badge variant={record ? 'success' : 'secondary'}>{record ? '已购' : '未购'}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {record ? dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') : '—'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ---------------- 概览 ----------------

function OverviewTab({ project, customDefs }: { project: Project; customDefs: CustomFieldDef[] }) {
  const [value, setValue] = useState<ProjectInput>(() => projectToInput(project))
  const { update } = useProjectMutations()

  const save = () => {
    const err = validateProjectInput(value, customDefs)
    if (err) {
      toast.error(err)
      return
    }
    update.mutate({ id: project.id, input: normalizeForSubmit(value, customDefs) })
  }

  return (
    <div className="space-y-4">
      <ProjectFormFields value={value} onChange={setValue} />
      <div className="flex items-center justify-between gap-4 border-t pt-3">
        <div className="text-xs text-muted-foreground">
          创建于 {dayjs(project.createdAt).format('YYYY-MM-DD HH:mm')} · 更新于{' '}
          {dayjs(project.updatedAt).format('YYYY-MM-DD HH:mm')}
        </div>
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? '保存中…' : '保存'}
        </Button>
      </div>
    </div>
  )
}

// ---------------- 进展时间线 ----------------

function ProgressTab({ projectId, logs }: { projectId: ID; logs: ProgressLog[] }) {
  const [logDate, setLogDate] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [content, setContent] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ProgressLog | null>(null)
  const { add, remove } = useProgressMutations(projectId)

  const submit = () => {
    if (!content.trim()) {
      toast.error('请填写进展内容')
      return
    }
    if (!logDate) {
      toast.error('请选择日期')
      return
    }
    add.mutate(
      { logDate, content: content.trim() },
      { onSuccess: () => setContent('') },
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Label className="shrink-0">日期</Label>
          <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-44" />
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录本次进展…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={add.isPending}>
            <Plus className="h-4 w-4" />
            记录进展
          </Button>
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="暂无进展记录" description="在上方录入第一条进展" />
      ) : (
        <div className="ml-2 space-y-5 border-l pl-5">
          {logs.map((log) => (
            <div key={log.id} className="relative">
              <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{dayjs(log.logDate).format('YYYY-MM-DD')}</Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingDelete(log)}
                  aria-label="删除进展"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{log.content}</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="删除进展"
        description="确定删除这条进展记录吗？删除后不可恢复。"
        confirmText="删除"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

// ---------------- 按月收入 ----------------

interface RevenueRow {
  month: string
  amount: string
}

function RevenueTab({ projectId, revenues }: { projectId: ID; revenues: Revenue[] }) {
  const toRows = (list: Revenue[]): RevenueRow[] =>
    list.map((r) => ({ month: r.month, amount: String(r.amount) }))

  const [rows, setRows] = useState<RevenueRow[]>(() => toRows(revenues))
  const [dirty, setDirty] = useState(false)
  const [newMonth, setNewMonth] = useState('')
  const save = useSaveRevenues()

  // 项目切换或保存成功后重新同步；有未保存改动时不覆盖
  useEffect(() => {
    if (!dirty) setRows(toRows(revenues))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, revenues, dirty])

  const setAmount = (month: string, amount: string) => {
    setDirty(true)
    setRows(rows.map((r) => (r.month === month ? { ...r, amount } : r)))
  }

  const addMonth = () => {
    if (!isValidMonth(newMonth)) {
      toast.error('请输入有效月份（YYYY-MM）')
      return
    }
    if (rows.some((r) => r.month === newMonth)) {
      toast.error('该月份已存在')
      return
    }
    setDirty(true)
    setRows([...rows, { month: newMonth, amount: '' }].sort((a, b) => a.month.localeCompare(b.month)))
    setNewMonth('')
  }

  const submit = () => {
    for (const r of rows) {
      if (r.amount.trim() !== '' && Number.isNaN(Number(r.amount))) {
        toast.error(`${r.month} 的金额不是有效数字`)
        return
      }
    }
    save.mutate(
      rows.map((r) => ({
        projectId,
        month: r.month,
        amount: r.amount.trim() === '' ? null : Number(r.amount),
      })),
      { onSuccess: () => setDirty(false) },
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">金额单位：万元；清空金额表示删除该月收入记录。</p>

      {rows.length === 0 ? (
        <EmptyState title="暂无收入记录" description="在下方添加月份开始录入" />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.month} className="flex items-center gap-3">
              <Badge variant="secondary" className="w-20 justify-center">
                {r.month}
              </Badge>
              <Input
                type="number"
                value={r.amount}
                onChange={(e) => setAmount(r.month, e.target.value)}
                placeholder="金额（万元）"
                className="w-44"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t pt-3">
        <Label className="shrink-0">添加月份</Label>
        <Input type="month" value={newMonth} onChange={(e) => setNewMonth(e.target.value)} className="w-44" />
        <Button variant="outline" size="sm" onClick={addMonth}>
          <Plus className="h-4 w-4" />
          添加
        </Button>
        <Button size="sm" className="ml-auto" onClick={submit} disabled={!dirty || save.isPending}>
          {save.isPending ? '保存中…' : '保存收入'}
        </Button>
      </div>
    </div>
  )
}

// ---------------- 修改日志 ----------------

function ChangeLogTab({ logs, customDefs }: { logs: ChangeLog[]; customDefs: CustomFieldDef[] }) {
  if (logs.length === 0) return <EmptyState title="暂无修改日志" />
  const display = (v: string) => (v === '' ? '（空）' : v)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>时间</TableHead>
          <TableHead>字段</TableHead>
          <TableHead>变更</TableHead>
          <TableHead>来源</TableHead>
          <TableHead>操作人</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className={cn('whitespace-nowrap text-muted-foreground')}>
              {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')}
            </TableCell>
            <TableCell className="whitespace-nowrap">{changeLogFieldLabel(log.field, customDefs)}</TableCell>
            <TableCell className="max-w-72">
              <span className="break-all">{display(log.oldValue)}</span>
              <span className="mx-1 text-muted-foreground">→</span>
              <span className="break-all">{display(log.newValue)}</span>
            </TableCell>
            <TableCell>
              <Badge variant={log.source === 'import' ? 'info' : 'secondary'}>
                {changeLogSourceLabel(log.source)}
              </Badge>
            </TableCell>
            <TableCell>{log.operator || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
