import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BackLink } from '@/components/ui/BackLink'

export function PageHeader({
  backHref,
  title,
  subtitle,
  action,
  compact = false,
  className,
}: {
  backHref?: string
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('ui-header', compact && 'py-1', className)}>
      {backHref ? <BackLink href={backHref} className="mr-3 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        <div className={cn('ui-title truncate', compact && 'text-[18px]')}>{title}</div>
        {subtitle ? <div className="ui-subtitle mt-1">{subtitle}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

