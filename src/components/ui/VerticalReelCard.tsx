'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

export type VerticalReelCardProps = {
  href: string
  title: ReactNode
  /** Optional supporting line (e.g. "Питание по расписанию") */
  support?: ReactNode
  /** Optional visual: image URL or placeholder */
  image?: string | null
  cta: ReactNode
  className?: string
}

/**
 * Vertical reel card (9:16): scenario / micro-funnel.
 * Minimal UI, large typography, one CTA at bottom. No navigation duplication, no OO decoration.
 */
export function VerticalReelCard({
  href,
  title,
  support,
  image,
  cta,
  className,
}: VerticalReelCardProps) {
  const card = (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden transition active:scale-[0.99]',
        'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]',
        'shadow-[var(--shadow-soft)]',
        image && 'p-2',
        className
      )}
      style={{
        borderRadius: 'var(--radius-large)',
        aspectRatio: '4/5',
        minWidth: 260,
        width: 'min(82vw, 340px)',
      }}
    >
      {/* Visual / content area */}
      <div className={cn('relative flex min-h-0 flex-1 flex-col justify-between', image ? 'gap-2' : 'p-5')}>
        {image ? (
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] bg-[color:var(--surface)]">
            <OptimizedImage
              src={image}
              alt=""
              sizes={IMAGE_SIZES.reelCard}
              className="object-cover"
              quality={75}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/55 to-transparent" aria-hidden />
          </div>
        ) : (
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 20%, var(--bg-grad-a), transparent 60%), var(--bg-grad-b)',
            }}
            aria-hidden
          />
        )}
        {!image ? (
          <span
            aria-hidden
            className="absolute left-4 top-4 inline-flex rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]"
          >
            подборка
          </span>
        ) : null}
        <div className={cn(
          'relative min-w-0 flex flex-col justify-end',
          image ? 'rounded-[22px] bg-white/92 p-3 shadow-[0_10px_26px_rgba(0,0,0,0.08)] backdrop-blur' : 'flex-1'
        )}>
          <h2 className="text-[20px] font-extrabold leading-tight line-clamp-3 tracking-tight text-[color:var(--text)]">{title}</h2>
          {support ? (
            <p className="ui-muted mt-2 line-clamp-2 text-[13px]">{support}</p>
          ) : null}
          {image ? (
            <span className="mt-3 inline-flex w-fit items-center rounded-full bg-[color:var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(127,150,255,0.20)]">
              {cta}
            </span>
          ) : null}
        </div>
        {!image ? (
          <div className="relative mt-4">
            <span className="inline-flex items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-5 py-3 text-[14px] font-semibold text-[color:var(--text)]">
            {cta}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      className="snap-start shrink-0 h-full"
    >
      {card}
    </Link>
  )
}
