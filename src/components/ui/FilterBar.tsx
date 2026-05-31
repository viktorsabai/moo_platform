'use client'

import type { ReactNode } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface FilterBarProps {
  left?: ReactNode
  right?: ReactNode
  topLeft?: ReactNode
  topRight?: ReactNode
  chips?: ReactNode
  search?: ReactNode
  expanded?: ReactNode
  className?: string
}

export const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(function FilterBar(
  { left, right, topLeft, topRight, chips, search, expanded, className },
  ref
) {
  const effectiveLeft = topLeft ?? left
  const effectiveRight = topRight ?? right

  return (
    <div
      className={cn('overflow-hidden border border-[color:var(--stroke)] bg-[color:var(--surface)] p-1.5', className)}
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      {(effectiveLeft || effectiveRight) && (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className={cn('min-w-0', !effectiveRight && 'flex-1 w-full')}>{effectiveLeft}</div>
          {effectiveRight && <div className="shrink-0">{effectiveRight}</div>}
        </div>
      )}

      {search && <div className={cn(effectiveLeft || effectiveRight ? 'mb-1.5' : '')}>{search}</div>}

      {chips && (
        <div
          ref={ref}
          className={cn(
            '-mx-1.5 overflow-x-auto px-1.5 pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            effectiveLeft || effectiveRight || search ? 'mt-1.5' : ''
          )}
        >
          <div className="flex items-center gap-1.5">{chips}</div>
        </div>
      )}

      {expanded && (
        <div
          className={cn(
            'mt-1.5 border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-1.5',
            !(effectiveLeft || effectiveRight || search || chips) ? 'mt-0' : ''
          )}
          style={{ borderRadius: 'var(--radius-medium)' }}
        >
          {expanded}
        </div>
      )}
    </div>
  )
})
