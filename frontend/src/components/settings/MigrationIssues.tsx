import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table'
export function MigrationIssues() {
  const query = useQuery({ queryKey: ['migration-issues'], queryFn: () => api.getMigrationIssues() })
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">无法可靠判断的历史字段保留原值，不用默认值掩盖。请到对应项目编辑确认后，再刷新清单。</p><Button variant="outline" onClick={() => void query.refetch()}>刷新清单</Button>{query.isError ? <p role="alert">清单加载失败</p> : query.isPending ? <p>加载中…</p> : !query.data?.length ? <p>没有待处理的迁移异常。</p> : <Table><TableHeader><TableRow><TableHead>项目编号</TableHead><TableHead>范围</TableHead><TableHead>原始值</TableHead><TableHead>原因</TableHead></TableRow></TableHeader><TableBody>{query.data.map((i) => <TableRow key={i.id}><TableCell>{i.projectId ?? '配置'}</TableCell><TableCell>{i.area}</TableCell><TableCell>{i.originalValue}</TableCell><TableCell>{i.reason}</TableCell></TableRow>)}</TableBody></Table>}</div>
}
