import type { BackgroundJob, JobApi } from './types'

export const taskChanged = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('presales:tasks-changed')) }
export const isJobRunning = (job: BackgroundJob) => ['QUEUED', 'RUNNING'].includes(job.status)
export async function waitForJob<T>(api: JobApi, initial: BackgroundJob): Promise<T> {
  taskChanged()
  let job = initial
  while (isJobRunning(job)) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    job = await api.getJob(job.id)
  }
  taskChanged()
  if (job.status === 'INTERRUPTED') throw new Error(`任务已中断，成功项保留。请在后台任务中重试未成功项（${job.id}）`)
  return await api.getJobResult(job.id) as T
}
