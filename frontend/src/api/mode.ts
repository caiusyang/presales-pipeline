export type ApiMode = 'mock' | 'http'

export function resolveApiMode(value: string | undefined): ApiMode {
  const mode = value?.trim() || 'http'
  if (mode !== 'http' && mode !== 'mock') {
    throw new Error(`VITE_API_MODE 仅支持 http 或 mock，当前值为：${mode}`)
  }
  return mode
}
