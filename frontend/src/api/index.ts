import type { ApiClient } from './types'
import { mockApi } from './mock'
import { httpApi } from './http'

// ============================================================
// API 入口：通过环境变量切换实现
//   VITE_API_MODE=mock  → 浏览器内模拟后端（默认，开箱即用，数据存 localStorage）
//   VITE_API_MODE=http  → 对接真实 Spring Boot /api
// ============================================================

export const API_MODE = (import.meta.env.VITE_API_MODE ?? 'mock') as 'mock' | 'http'

export const api: ApiClient = API_MODE === 'http' ? httpApi : mockApi

export type { ApiClient } from './types'
export * from './types'
