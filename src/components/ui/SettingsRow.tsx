import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IconChevronRight } from '@/components/ui/icons'

type BaseProps = {
  title: ReactNode
  left?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  className?: string
  /** Inside an outer card: no inner border/surface (avoids “block in block”). */
  inset?: boolean
}

type LinkProps = BaseProps & {
  href: string
  onClick?: never
}

type ButtonProps = BaseProps & {
  href?: never
  onClick: () => void
  disabled?: boolean
}

export type SettingsRowProps = LinkProps | ButtonProps

function RowContent({ left, title, subtitle, right, inset }: BaseProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        inset
          ? 'bg-transparent px-1 py-2.5'
          : 'rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5'
      )}
      style={inset ? undefined : { borderRadius: 'var(--radius-medium)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {left ? <span className="shrink-0">{left}</span> : null}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[color:var(--text)]">{title}</div>
          {subtitle ? <div className="ui-muted mt-0.5 truncate text-[12px]">{subtitle}</div> : null}
        </div>
      </div>
      {right ? right : <IconChevronRight className="h-4 w-4 shrink-0 text-[color:var(--muted)]" />}
    </div>
  )
}

export function SettingsRow(props: SettingsRowProps) {
  if (typeof (props as LinkProps).href === 'string') {
    const { href, className, ...rest } = props as LinkProps
    return (
      <Link href={href} prefetch={false} className={cn('block', className)}>
        <RowContent {...rest} />
      </Link>
    )
  }
  const { onClick, className, disabled, ...rest } = props as ButtonProps
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('block w-full text-left', disabled && 'cursor-default', className)}
    >
      <RowContent {...rest} />
    </button>
  )
}
