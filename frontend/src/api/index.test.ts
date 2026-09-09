import { describe, expect, it } from 'vitest'
import { resolveApiMode } from './mode'

describe('resolveApiMode', () => {
  it('defaults to the real backend', () => {
    expect(resolveApiMode(undefined)).toBe('http')
    expect(resolveApiMode('')).toBe('http')
  })

  it('allows explicitly selected mock mode', () => {
    expect(resolveApiMode('mock')).toBe('mock')
  })

  it('rejects invalid values instead of silently using mock data', () => {
    expect(() => resolveApiMode('production')).toThrow('仅支持 http 或 mock')
  })
})
