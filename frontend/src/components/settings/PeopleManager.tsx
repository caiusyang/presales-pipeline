import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api'
import { waitForJob } from '@/api/jobs'
import { usePeople } from '@/hooks/queries'
import type { Person, PersonInput } from '@/lib/people'
import { parseExcelFileAsync, downloadExportXlsxAsync } from '@/components/impexp/excelAsync'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
const blank = (): PersonInput => ({ name: '', employeeNo: null, account: null, aliases: [], enabled: true })
export function PeopleManager() {
  const query = usePeople(), qc = useQueryClient()
  const [editing, setEditing] = useState<Person | null | undefined>(), [form, setForm] = useState<PersonInput>(blank), [aliases, setAliases] = useState('')
  const [preview, setPreview] = useState<PersonInput[] | null>(null), [parsing, setParsing] = useState(false)
  const save = useMutation({ mutationFn: () => api.savePerson({ ...form, aliases: aliases.split(/[,，、\n]/).map((s) => s.trim()).filter(Boolean) }, editing?.id), onSuccess: () => { setEditing(undefined); void qc.invalidateQueries({ queryKey: ['people'] }); toast.success('责任人已保存') }, onError: (e) => toast.error(e.message) })
  const importRows = useMutation({ mutationFn: async () => waitForJob<{ succeeded: number; failed: number }>(api, await api.startPeopleImport({ requestId: crypto.randomUUID(), people: preview! })), onSuccess: (result) => { setPreview(null); void qc.invalidateQueries({ queryKey: ['people'] }); toast.success(`成功 ${result.succeeded} 条，失败 ${result.failed} 条；逐项结果和失败重试见后台任务`) }, onError: (e) => toast.error(e.message) })
  const open = (p: Person | null) => { setEditing(p); setForm(p ?? blank()); setAliases(p?.aliases.join('、') ?? '') }
  const parse = async (file: File) => {
    setParsing(true)
    try {
      const sheet = await parseExcelFileAsync(file)
      const column = (names: string[]) => sheet.headers.findIndex((h) => names.includes(h.trim().split('/').at(-1)?.trim() ?? h.trim()))
      const indices = { name: column(['姓名', '责任人', 'name']), employeeNo: column(['工号', 'employeeNo']), account: column(['平台账号', '账号', 'account']), aliases: column(['别名', '确认别名', 'aliases']), enabled: column(['启用', '状态', 'enabled']) }
      if (indices.name < 0) throw new Error('文件必须包含“姓名”列；其他支持列为工号、平台账号、别名、启用')
      const rows = sheet.rows.filter((r) => r.some((s) => s.trim())).map((r) => ({ name: r[indices.name]?.trim() ?? '', employeeNo: r[indices.employeeNo]?.trim() || null, account: r[indices.account]?.trim() || null, aliases: (r[indices.aliases] ?? '').split(/[,，、\n]/).map((s) => s.trim()).filter(Boolean), enabled: !['否', '停用', 'false', '0'].includes((r[indices.enabled] ?? '').trim()) }))
      if (!rows.length || rows.length > 5000) throw new Error('每次导入1至5000行')
      setPreview(rows)
    } catch (e) { toast.error((e as Error).message) } finally { setParsing(false) }
  }
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">优先工号或账号精确匹配；没有唯一标识时，只接受唯一姓名或已确认别名。同名歧义不自动绑定。停用人员保留历史关联。</p>
    <div className="flex flex-wrap gap-2"><Button onClick={() => open(null)}>新增责任人</Button><label className="inline-flex cursor-pointer items-center rounded border bg-background px-3 text-sm">{parsing ? '解析中…' : '导入 Excel / CSV'}<input aria-label="导入责任人文件" className="hidden" type="file" accept=".xlsx,.xls,.csv" disabled={parsing} onChange={(e) => { if (e.target.files?.[0]) void parse(e.target.files[0]); e.target.value = '' }} /></label><Button variant="outline" onClick={() => void downloadExportXlsxAsync(['姓名', '工号', '平台账号', '别名', '启用'].map((s) => ({ key: s, title: s })), [], '责任人库', '责任人导入模板.xlsx')}>下载模板</Button></div>
    <Table><TableHeader><TableRow><TableHead>姓名</TableHead><TableHead>工号</TableHead><TableHead>平台账号</TableHead><TableHead>确认别名</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>{(query.data ?? []).map((p) => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.employeeNo || '—'}</TableCell><TableCell>{p.account || '—'}</TableCell><TableCell>{p.aliases.join('、') || '—'}</TableCell><TableCell>{p.enabled ? '启用' : '停用'}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => open(p)}>编辑</Button></TableCell></TableRow>)}</TableBody></Table>
    <Dialog open={editing !== undefined} onOpenChange={(v) => !v && setEditing(undefined)}><DialogContent><DialogHeader><DialogTitle>{editing ? '编辑责任人' : '新增责任人'}</DialogTitle><DialogDescription>别名请仅录入你确认过的名称，允许同名但不会自动匹配同名歧义。</DialogDescription></DialogHeader><div className="space-y-3">{(['name', 'employeeNo', 'account'] as const).map((key) => <Label key={key}>{({ name: '姓名', employeeNo: '工号', account: '平台账号' })[key]}<Input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Label>)}<Label>确认别名（顿号或逗号分隔）<Input value={aliases} onChange={(e) => setAliases(e.target.value)} /></Label><label className="flex items-center gap-2"><Checkbox checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v === true })} />启用</label></div><DialogFooter><Button variant="outline" onClick={() => setEditing(undefined)}>取消</Button><Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>保存</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={preview !== null} onOpenChange={(v) => !v && !importRows.isPending && setPreview(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>确认导入 {preview?.length} 位责任人</DialogTitle><DialogDescription>按工号／账号更新已有人员；没有唯一标识时仅更新唯一同名人员，否则逐行报错。成功项不会被失败项回滚。</DialogDescription></DialogHeader><div className="max-h-72 overflow-auto"><Table><TableHeader><TableRow><TableHead>姓名</TableHead><TableHead>工号</TableHead><TableHead>账号</TableHead><TableHead>别名</TableHead></TableRow></TableHeader><TableBody>{preview?.slice(0, 30).map((p, i) => <TableRow key={i}><TableCell>{p.name || '【缺姓名，待修正】'}</TableCell><TableCell>{p.employeeNo}</TableCell><TableCell>{p.account}</TableCell><TableCell>{p.aliases.join('、')}</TableCell></TableRow>)}</TableBody></Table></div><DialogFooter><Button variant="outline" disabled={importRows.isPending} onClick={() => setPreview(null)}>取消</Button><Button disabled={importRows.isPending} onClick={() => importRows.mutate()}>{importRows.isPending ? '后台处理中…' : '确认导入'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
