'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

export type PromoCardProps = {
  href: string
  title: ReactNode
  description?: ReactNode
  image?: string | null
  cta: ReactNode
  className?: string
}

/**
 * Promo card for selling carousel: banner-style, fixed height.
 * Content only: title, optional description, CTA. No decorative graphics.
 */
export function PromoCard({ href, title, description, image, cta, className }: PromoCardProps) {
  const card = (
    <div
      className={cn(
        'relative flex h-[140px] w-[min(88vw,400px)] min-w-[min(82vw,340px)] flex-col justify-between overflow-hidden p-5 transition active:scale-[0.99]',
        'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]',
        'shadow-[var(--shadow-soft)]',
        className
      )}
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          background:
            'radial-gradient(120% 90% at 10% -10%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 55%), radial-gradient(120% 90% at 100% 100%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%)',
        }}
      />
      <span aria-hidden className="absolute right-4 top-3 text-[18px] opacity-70">✦</span>
      {image ? (
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[42%] overflow-hidden">
          <OptimizedImage
            src={image}
            alt=""
            sizes={IMAGE_SIZES.homeBanner}
            className="object-cover"
            quality={75}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--surface-strong)] via-transparent to-transparent" />
        </div>
      ) : null}
      <div className={cn('min-w-0', image && 'max-w-[68%]')}>
        <h2 className="relative z-[1] text-[18px] font-extrabold leading-tight line-clamp-2 tracking-tight">{title}</h2>
        {description ? (
          <p className="ui-muted relative z-[1] mt-1 line-clamp-1 text-[13px]">{description}</p>
        ) : null}
      </div>
      <div className="relative z-[1] mt-3">
        <span className="inline-flex items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-2.5 text-[13px] font-semibold text-[color:var(--text)]">
          {cta}
        </span>
      </div>
    </div>
  )

  return (
    <Link href={href} prefetch={false} scroll={false} className="snap-start shrink-0">
      {card}
    </Link>
  )
}
