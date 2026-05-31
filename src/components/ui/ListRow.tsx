import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IconChevronRight } from './icons'

export interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  left?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  right?: ReactNode
  divider?: boolean
  chevron?: boolean
  onClick?: () => void
}

export function ListRow({
  left,
  title,
  subtitle,
  meta,
  right,
  divider = true,
  chevron = false,
  onClick,
  className,
  ...props
}: ListRowProps) {
  const content = (
    <div className={cn(
      'flex items-start justify-between gap-4',
      divider ? 'border-b border-[color:var(--stroke)]' : '',
      onClick ? 'cursor-pointer active:opacity-90' : '',
      className
    )} {...props}>
      <div className="flex min-w-0 items-start gap-3 flex-1">
        {left ? <div className="shrink-0">{left}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="ui-body truncate">{title}</div>
          {subtitle ? <div className="ui-muted mt-0.5 line-clamp-1">{subtitle}</div> : null}
          {meta ? <div className="ui-muted mt-1 text-[12px]">{meta}</div> : null}
        </div>
      </div>
      {right ? (
        <div className="shrink-0">{right}</div>
      ) : chevron ? (
        <div className="shrink-0 text-[color:var(--muted)]">
          <IconChevronRight className="h-5 w-5" />
        </div>
      ) : null}
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        {content}
      </button>
    )
  }

  return content
}

