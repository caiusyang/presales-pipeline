import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, BarChart3, Upload, Download, Settings, DatabaseZap, LogOut, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_MODE } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/AuthContext'

const NAV = [
  { to: '/', label: '项目管道', icon: LayoutGrid, end: true },
  { to: '/customers', label: '客户分析', icon: Users },
  { to: '/revenue', label: '收入统计', icon: BarChart3 },
  { to: '/import', label: '导入', icon: Upload },
  { to: '/export', label: '导出', icon: Download },
  { to: '/settings', label: '配置', icon: Settings },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 侧边栏 */}
      <aside className="flex w-52 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <DatabaseZap className="h-5 w-5 text-primary" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">售前项目管道</div>
            <div className="text-[10px] text-muted-foreground">Presales Pipeline</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate" title={user?.username}>{user?.username}</span>
            {API_MODE === 'http' && user?.authenticationEnabled !== false && (
              <Button variant="ghost" size="icon-sm" aria-label="退出登录" onClick={() => void logout()}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Badge variant={API_MODE === 'mock' ? 'warning' : 'success'} className="w-full justify-center">
            {API_MODE === 'mock' ? '演示数据模式' : '已连接后端'}
          </Badge>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <Outlet />
      </main>
    </div>
  )
}
