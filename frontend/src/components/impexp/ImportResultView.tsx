import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ImportRecordResult, ImportResult } from '@/api/types'

const STATUS_META: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  added: { label: '新增', variant: 'success' },
  overwritten: { label: '覆盖', variant: 'info' },
  skipped: { label: '跳过', variant: 'secondary' },
  failed: { label: '失败', variant: 'destructive' },
}

const MAX_DETAIL_ROWS = 200

/** 导入预检/执行结果：新增/覆盖/跳过统计 + 逐行明细（Excel 行号 = row + 1） */
export function ImportResultView({ result, title }: { result: ImportResult; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
            <div className="text-2xl font-semibold text-emerald-700">{result.added}</div>
            <div className="text-xs text-emerald-600">新增</div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-center">
            <div className="text-2xl font-semibold text-sky-700">{result.overwritten}</div>
            <div className="text-xs text-sky-600">覆盖</div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3 text-center">
            <div className="text-2xl font-semibold text-muted-foreground">{result.skipped}</div>
            <div className="text-xs text-muted-foreground">跳过</div>
          </div>
        </div>

        <div className="max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-20">Excel 行</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>项目</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.details.slice(0, MAX_DETAIL_ROWS).map((d: ImportRecordResult) => {
                const meta = STATUS_META[d.status] ?? { label: d.status, variant: 'outline' as const }
                return (
                  <TableRow key={d.row}>
                    <TableCell className="text-xs text-muted-foreground">{d.row + 1}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-40 truncate" title={d.customerName ?? ''}>
                      {d.customerName ?? '-'}
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={d.projectName ?? ''}>
                      {d.projectName ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.reason ?? ''}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {result.details.length > MAX_DETAIL_ROWS && (
          <div className="text-xs text-muted-foreground">仅展示前 {MAX_DETAIL_ROWS} 条明细，共 {result.details.length} 条</div>
        )}
      </CardContent>
    </Card>
  )
}
