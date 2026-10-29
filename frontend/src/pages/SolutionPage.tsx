import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/api'
import { PROJECT_STATUSES } from '@/types'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
export default function SolutionPage() {
  const query = useQuery({ queryKey: ['stats', 'solutions'], queryFn: () => api.getSolutionStats() })
  const data = query.data
  return <div className="page-shell">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="page-heading"><h1>解决方案统计</h1><p className="text-sm text-muted-foreground">按本地售前状态统计，不分摊收入。{data?.notice}</p></div><Button variant="outline" onClick={() => void query.refetch()}>刷新</Button></header>
    {query.isError ? <p role="alert">统计加载失败</p> : !data ? <p>加载中…</p> : <><div className="grid gap-3 sm:grid-cols-3">{[['全局项目', data.totalProjectCount], ['已关联项目', data.coveredProjectCount], ['方案覆盖数', data.solutionCoverageCount]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}</div>
      <div className="overflow-hidden rounded-xl border bg-card">
      <Table><TableHeader><TableRow><TableHead>解决方案 / 细分方案</TableHead><TableHead>项目数</TableHead><TableHead>客户数</TableHead>{PROJECT_STATUSES.map((s) => <TableHead key={s}>{s}</TableHead>)}<TableHead>下钻</TableHead></TableRow></TableHeader><TableBody>{data.items.flatMap((s) => [<TableRow key={s.id}><TableCell className="font-medium">{s.solution}</TableCell><TableCell>{s.projectCount}</TableCell><TableCell>{s.customerCount}</TableCell>{PROJECT_STATUSES.map((status) => <TableCell key={status}>{s.statusCounts[status] ?? 0}</TableCell>)}<TableCell><Link className="text-primary underline" to={`/?solution=${encodeURIComponent(s.solution)}`}>查看项目</Link></TableCell></TableRow>, ...s.subSolutions.map((sub) => <TableRow key={`${s.id}-${sub.id}`}><TableCell className="pl-8">{sub.name}</TableCell><TableCell>{sub.projectCount}</TableCell><TableCell>{sub.customerCount}</TableCell><TableCell colSpan={4} className="text-xs text-muted-foreground">各细分方案项目可能重叠，不能相加为一级方案总数</TableCell><TableCell><Link className="text-primary underline" to={`/?solution=${encodeURIComponent(s.solution)}&subSolution=${encodeURIComponent(sub.name)}`}>查看项目</Link></TableCell></TableRow>)])}</TableBody></Table>
      </div>
    </>}</div>
}
