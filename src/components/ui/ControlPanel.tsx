import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ControlPanel({
  topLeft,
  topRight,
  search,
  chips,
  expanded,
  className,
}: {
  topLeft?: ReactNode
  topRight?: ReactNode
  search?: ReactNode
  chips?: ReactNode
  expanded?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('ui-surface overflow-hidden p-2', className)}>
      {(topLeft || topRight) ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">{topLeft}</div>
          <div className="shrink-0">{topRight}</div>
        </div>
      ) : null}

      {search ? <div className={cn(topLeft || topRight ? 'mt-2' : '')}>{search}</div> : null}
      {chips ? <div className={cn(topLeft || topRight || search ? 'mt-2' : '')}>{chips}</div> : null}
      {expanded ? <div className={cn(topLeft || topRight || search || chips ? 'mt-2' : '')}>{expanded}</div> : null}
    </div>
  )
}

