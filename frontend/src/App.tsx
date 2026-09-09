import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import LoginPage from '@/pages/LoginPage'

// 路由级懒加载：echarts/xlsx 等大依赖随页面分包
const PipelinePage = lazy(() => import('@/pages/PipelinePage'))
const RevenuePage = lazy(() => import('@/pages/RevenuePage'))
const ImportPage = lazy(() => import('@/pages/ImportPage'))
const ExportPage = lazy(() => import('@/pages/ExportPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function PageLoading() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function AuthenticatedApp() {
  const { status } = useAuth()
  if (status === 'loading') return <PageLoading />
  if (status === 'anonymous') return <LoginPage />
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Suspense fallback={<PageLoading />}><PipelinePage /></Suspense>} />
        <Route path="/revenue" element={<Suspense fallback={<PageLoading />}><RevenuePage /></Suspense>} />
        <Route path="/import" element={<Suspense fallback={<PageLoading />}><ImportPage /></Suspense>} />
        <Route path="/export" element={<Suspense fallback={<PageLoading />}><ExportPage /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<PageLoading />}><SettingsPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}
