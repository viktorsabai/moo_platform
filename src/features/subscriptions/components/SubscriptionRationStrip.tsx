'use client'

import { cn } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

export type RationStripLine = { key: string; dishId: string; quantity: number; image?: string; name: string }

type Props = {
  lines: RationStripLine[]
  className?: string
  dense?: boolean
  /** Тап по плитке — скролл к строке в списке (визард). */
  onSelectLine?: (lineKey: string) => void
}

/**
 * Горизонтальная мозаика выбранных блюд (превью рациона).
 */
export function SubscriptionRationStrip({ lines, className, dense, onSelectLine }: Props) {
  if (lines.length === 0) return null
  const size = dense ? 'h-11 w-11' : 'h-14 w-14'
  const interactive = Boolean(onSelectLine) && !dense
  return (
    <div
      className={cn('-mx-1 flex gap-1.5 overflow-x-auto pb-1 pt-0.5', className)}
      style={{ WebkitOverflowScrolling: 'touch' }}
      aria-label="выбранные блюда"
    >
      {lines.map((line) => {
        const inner = (
          <>
            {line.image ? (
              <OptimizedImage src={line.image} alt="" className="h-full w-full object-cover" sizes={IMAGE_SIZES.checkoutThumb} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--muted)]">—</div>
            )}
            {line.quantity > 1 ? (
              <span
                className="absolute bottom-0.5 right-0.5 grid min-w-[1.125rem] place-items-center rounded px-1 text-[10px] font-bold tabular-nums text-white shadow-sm"
                style={{ background: 'color-mix(in srgb, var(--text) 78%, transparent)', borderRadius: 'var(--radius-pill)' }}
              >
                ×{line.quantity}
              </span>
            ) : null}
          </>
        )
        const shellClass = cn(
          'relative shrink-0 overflow-hidden rounded-xl bg-black/[0.06]',
          size,
          interactive &&
            'cursor-pointer transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--primary)]'
        )
        if (interactive) {
          return (
            <button
              key={line.key}
              type="button"
              className={shellClass}
              style={{ borderRadius: 'var(--radius-medium)' }}
              title={line.name}
              aria-label={`${line.name}, перейти к позиции`}
              onClick={() => onSelectLine!(line.key)}
            >
              {inner}
            </button>
          )
        }
        return (
          <div
            key={line.key}
            className={shellClass}
            style={{ borderRadius: 'var(--radius-medium)' }}
            title={line.name}
          >
            {inner}
          </div>
        )
      })}
    </div>
  )
}
