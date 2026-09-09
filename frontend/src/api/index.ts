import type { ApiClient } from './types'
import { mockApi } from './mock'
import { httpApi } from './http'
import { resolveApiMode } from './mode'

// ============================================================
// API 入口：通过环境变量切换实现
//   VITE_API_MODE=http  → 对接真实 Spring Boot /api（默认）
//   VITE_API_MODE=mock  → 浏览器内模拟后端，仅用于明确启用的演示
// ============================================================

export const API_MODE = resolveApiMode(import.meta.env.VITE_API_MODE)

export const api: ApiClient = API_MODE === 'http' ? httpApi : mockApi

export type { ApiClient } from './types'
export type { ApiMode } from './mode'
export * from './types'
