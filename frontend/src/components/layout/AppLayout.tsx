import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, BarChart3, Upload, Download, Settings, DatabaseZap, LogOut, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_MODE } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/AuthContext'
import { TaskCenter } from '@/components/common/TaskCenter'
import { useProductCatalog } from '@/hooks/queries'

const NAV = [
  { to: '/', label: '项目管道', icon: LayoutGrid, end: true },
  { to: '/customers', label: '客户分析', icon: Users },
  { to: '/revenue', label: '收入统计', icon: BarChart3 },
  { to: '/solutions', label: '解决方案统计', icon: BarChart3 },
  { to: '/import', label: '导入', icon: Upload },
  { to: '/export', label: '导出', icon: Download },
  { to: '/settings', label: '配置', icon: Settings },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const catalog = useProductCatalog()
  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      {/* 侧边栏 */}
      <aside className="flex shrink-0 flex-col border-b bg-card md:w-16 md:border-r md:border-b-0 lg:w-52">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:justify-center md:px-2 lg:justify-start lg:px-4">
          <DatabaseZap className="h-5 w-5 shrink-0 text-primary" />
          <div className="leading-tight md:hidden lg:block">
            <div className="text-sm font-semibold">售前项目管道</div>
            <div className="text-[10px] text-muted-foreground">Presales Pipeline</div>
          </div>
          <Badge variant={API_MODE === 'mock' ? 'warning' : 'success'} className="ml-auto md:hidden">
            {API_MODE === 'mock' ? '演示模式' : '已连接后端'}
          </Badge>
          {API_MODE === 'http' && user?.authenticationEnabled !== false && <Button className="md:hidden" variant="ghost" size="icon-sm" aria-label="退出登录" onClick={() => void logout()}><LogOut /></Button>}
        </div>
        <nav aria-label="主导航" className="flex gap-1 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:justify-center md:px-2 lg:justify-start lg:px-3',
                  isActive && 'bg-accent text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="md:sr-only lg:not-sr-only">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t p-2 md:block lg:p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="hidden truncate lg:inline" title={user?.username}>{user?.username}</span>
            {API_MODE === 'http' && user?.authenticationEnabled !== false && (
              <Button variant="ghost" size="icon-sm" aria-label="退出登录" onClick={() => void logout()}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Badge variant={API_MODE === 'mock' ? 'warning' : 'success'} className="w-full justify-center">
            <span className="lg:hidden">{API_MODE === 'mock' ? '演示' : '在线'}</span>
            <span className="hidden lg:inline">{API_MODE === 'mock' ? '演示数据模式' : '已连接后端'}</span>
          </Badge>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-muted/30">
        {catalog.isPending ? <p className="p-6">正在加载产品目录…</p> : catalog.isError ? <div className="p-6">产品目录加载失败，暂不允许使用旧目录录入。<Button onClick={() => void catalog.refetch()}>重新加载</Button></div> : <Outlet />}
        <TaskCenter />
      </main>
    </div>
  )
}
