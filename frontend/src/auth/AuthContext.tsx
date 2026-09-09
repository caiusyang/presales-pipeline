import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { API_MODE } from '@/api'
import { ApiError, authApi, type AuthUser } from '@/api/http'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const mockUser = API_MODE === 'mock'
    ? { username: '演示用户', roles: ['ROLE_ADMIN'], authenticationEnabled: false }
    : null
  const [status, setStatus] = useState<AuthStatus>(mockUser ? 'authenticated' : 'loading')
  const [user, setUser] = useState<AuthUser | null>(mockUser)

  useEffect(() => {
    if (API_MODE === 'mock') return

    const markAnonymous = () => {
      setUser(null)
      setStatus('anonymous')
    }
    window.addEventListener('presales:unauthorized', markAnonymous)
    authApi.currentUser()
      .then((currentUser) => {
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 401) console.error('登录状态检查失败', error)
        markAnonymous()
      })
    return () => window.removeEventListener('presales:unauthorized', markAnonymous)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    login: async (username, password) => {
      const currentUser = await authApi.login(username, password)
      setUser(currentUser)
      setStatus('authenticated')
    },
    logout: async () => {
      try {
        await authApi.logout()
      } finally {
        setUser(null)
        setStatus('anonymous')
      }
    },
  }), [status, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return value
}
