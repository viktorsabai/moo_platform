'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BrandMarkOO } from '@/components/ui/BrandMarkOO'

export type ActionCardVariant = 'row' | 'grid'

export function ActionCard({
  href,
  title,
  subtitle,
  icon,
  right,
  mark,
  variant = 'row',
  className,
}: {
  href: string
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  right?: ReactNode
  mark?: boolean
  variant?: ActionCardVariant
  className?: string
}) {
  if (variant === 'grid') {
    return (
      <Link href={href} prefetch={false} scroll={false} className="block">
        <div
          className={cn(
            'ui-surface-strong flex aspect-square min-h-[140px] flex-col items-center justify-center gap-3 overflow-hidden p-4 transition active:scale-[0.99]',
            className
          )}
          style={{ borderRadius: 'var(--radius-large)' }}
        >
          <span className="text-3xl leading-none" aria-hidden>
            {icon ?? '›'}
          </span>
          <span className="ui-body line-clamp-2 text-center font-semibold">{title}</span>
        </div>
      </Link>
    )
  }

  return (
    <Link href={href} prefetch={false} scroll={false} className="snap-start">
      <div
        className={cn(
          'ui-surface-strong overflow-hidden p-4 transition active:scale-[0.99]',
          className
        )}
        style={{ borderRadius: 'var(--radius-large)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <div
                className="grid h-10 w-10 shrink-0 place-items-center bg-black/[0.03] text-black/65"
                style={{ borderRadius: 'var(--radius-medium)' }}
              >
                {icon}
              </div>
            ) : mark ? (
              <div
                className="grid h-10 w-10 shrink-0 place-items-center border border-black/10 bg-white/70"
                style={{ borderRadius: 'var(--radius-medium)' }}
              >
                <BrandMarkOO size={22} />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="ui-body truncate font-semibold">{title}</div>
              {subtitle ? <div className="ui-muted mt-0.5 truncate text-[12px]">{subtitle}</div> : null}
            </div>
          </div>
          <div
            className="grid h-10 w-10 shrink-0 place-items-center bg-black/[0.02] text-[18px] text-black/45"
            style={{ borderRadius: 'var(--radius-medium)' }}
          >
            {right ?? '›'}
          </div>
        </div>
      </div>
    </Link>
  )
}
