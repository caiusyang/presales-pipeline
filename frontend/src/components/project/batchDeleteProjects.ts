import type { ID } from '@/types'

export interface BatchDeleteProjectsResult {
  deletedIds: ID[]
  failures: { id: ID; message: string }[]
}

/** 复用单项目软删除接口，限制并发，并保留每个项目的真实执行结果。 */
export async function batchDeleteProjects(
  ids: ID[],
  deleteProject: (id: ID) => Promise<void>,
): Promise<BatchDeleteProjectsResult> {
  const pending = [...new Set(ids)]
  const outcomes = new Map<ID, string | null>()
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (next < pending.length) {
      const id = pending[next++]
      try {
        await deleteProject(id)
        outcomes.set(id, null)
      } catch (error) {
        outcomes.set(id, error instanceof Error && error.message ? error.message : '删除结果未确认，请刷新列表或回收站核对')
      }
    }
  }))
  return {
    deletedIds: pending.filter((id) => outcomes.get(id) === null),
    failures: pending.filter((id) => outcomes.get(id) != null).map((id) => ({ id, message: outcomes.get(id)! })),
  }
}
