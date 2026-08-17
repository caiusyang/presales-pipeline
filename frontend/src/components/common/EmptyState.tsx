import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  title = '暂无数据',
  description,
  className,
  children,
}: {
  title?: string
  description?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-14 text-center', className)}>
      <Inbox className="h-8 w-8 text-muted-foreground/50" />
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      {description && <div className="text-xs text-muted-foreground/70">{description}</div>}
      {children}
    </div>
  )
}
