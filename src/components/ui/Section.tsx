import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Section({
  title,
  meta,
  action,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: ReactNode
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <section className={cn('ui-section', className)} {...props}>
      {(title || meta || action) && (
        <div className="ui-sectionHead">
          <div className="min-w-0">
            {title ? <div className="ui-sectionTitle">{title}</div> : null}
            {meta ? <div className="ui-sectionMeta">{meta}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}

