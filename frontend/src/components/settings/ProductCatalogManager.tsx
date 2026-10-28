import { useState } from 'react'
import { useProductCatalog, useProductCatalogMutations } from '@/hooks/queries'
import type { ProductDefinition, ProductInput } from '@/lib/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
const blank = (): ProductInput => ({ code: '', name: '', aliases: [], applicableTracks: [], sortOrder: 100, enabled: true })
export function ProductCatalogManager() {
  const query = useProductCatalog(), save = useProductCatalogMutations()
  const [editing, setEditing] = useState<ProductDefinition | null | undefined>(undefined)
  const [form, setForm] = useState<ProductInput>(blank)
  const [aliases, setAliases] = useState('')
  const open = (product: ProductDefinition | null) => { setEditing(product); setForm(product ? { ...product } : blank()); setAliases(product?.aliases.join('、') ?? '') }
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">编码创建后不可修改。名称、别名、适用赛道可维护；停用只禁止新增选择，历史项目和导出保留。方案字典中的产品节点引用此目录。</p><Button onClick={() => open(null)}>新增产品</Button></div>
    <Table><TableHeader><TableRow><TableHead>编码</TableHead><TableHead>名称</TableHead><TableHead>别名</TableHead><TableHead>赛道</TableHead><TableHead>状态</TableHead><TableHead>排序</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>
      {(query.data ?? []).map((p) => <TableRow key={p.id}><TableCell>{p.code}</TableCell><TableCell>{p.name}</TableCell><TableCell>{p.aliases.join('、') || '—'}</TableCell><TableCell>{p.applicableTracks.join('、') || '公共'}</TableCell><TableCell>{p.enabled ? '启用' : '已停用'}</TableCell><TableCell>{p.sortOrder}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => open(p)}>编辑</Button></TableCell></TableRow>)}
    </TableBody></Table>
    <Dialog open={editing !== undefined} onOpenChange={(v) => !v && setEditing(undefined)}><DialogContent><DialogHeader><DialogTitle>{editing ? '编辑产品' : '新增产品'}</DialogTitle><DialogDescription>别名仅帮助识别产品，不表示该项目已经购买。</DialogDescription></DialogHeader>
      <div className="space-y-3"><Label>稳定编码<Input value={form.code} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Label><Label>展示名称<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Label><Label>别名（逗号或顿号分隔）<Input value={aliases} onChange={(e) => setAliases(e.target.value)} /></Label><Label>排序<Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></Label>
        <fieldset><legend className="mb-2 text-sm">适用赛道（不勾选为公共）</legend><div className="flex gap-4">{['HCS', '公有云'].map((t) => <label className="flex items-center gap-2" key={t}><Checkbox checked={form.applicableTracks.includes(t)} onCheckedChange={(v) => setForm({ ...form, applicableTracks: v ? [...form.applicableTracks, t] : form.applicableTracks.filter((s) => s !== t) })} />{t}</label>)}</div></fieldset>
        <label className="flex items-center gap-2"><Checkbox checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v === true })} />启用（取消后历史记录仍保留）</label>
      </div><DialogFooter><Button variant="outline" onClick={() => setEditing(undefined)}>取消</Button><Button disabled={!form.code.trim() || !form.name.trim() || save.isPending} onClick={() => save.mutate({ id: editing?.id, input: { ...form, aliases: aliases.split(/[,，、\n]/).map((s) => s.trim()).filter(Boolean) } }, { onSuccess: () => setEditing(undefined) })}>保存</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>
}
