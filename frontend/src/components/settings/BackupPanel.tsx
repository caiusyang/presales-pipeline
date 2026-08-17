import { toast } from 'sonner'
import dayjs from 'dayjs'
import { DatabaseBackup, Download } from 'lucide-react'
import { API_MODE } from '@/api'
import { useBackup } from '@/hooks/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function BackupPanel() {
  const backup = useBackup()

  const handleExport = async () => {
    try {
      const data = await backup.mutateAsync()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `presales-backup-${dayjs().format('YYYY-MM-DD')}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('备份已导出')
    } catch {
      // 错误提示由 hook 统一 toast
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseBackup className="h-4 w-4" /> 全量备份
          </CardTitle>
          <CardDescription>
            本平台是售前数据的唯一数据源。docker 部署后由 MySQL 每日自动备份并保留 30 天；
            此处提供一键全量 JSON 导出作为兜底。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={backup.isPending}>
            <Download className="h-4 w-4" />
            {backup.isPending ? '导出中…' : '导出全量备份'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运行模式</CardTitle>
        </CardHeader>
        <CardContent>
          {API_MODE === 'mock' ? (
            <p className="text-sm text-muted-foreground">
              当前为演示数据模式，数据存于浏览器 localStorage，清缓存会丢；正式使用请部署后端并设
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">VITE_API_MODE=http</code>。
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">已连接后端，数据持久化于服务端数据库。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
