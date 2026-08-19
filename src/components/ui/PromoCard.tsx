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
        'group relative flex h-[210px] w-[min(88vw,420px)] min-w-[min(82vw,350px)] flex-col justify-end overflow-hidden p-5 transition duration-300 active:scale-[0.985] hover:-translate-y-0.5',
        'border border-white/20 bg-[color:var(--text)]',
        'shadow-[0_18px_42px_rgba(15,23,42,0.16)]',
        className
      )}
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.42]"
        style={{
          background:
            'linear-gradient(180deg, transparent 18%, rgba(8,12,20,0.82) 100%), radial-gradient(120% 90% at 10% -10%, color-mix(in srgb, var(--accent) 42%, transparent), transparent 62%)',
        }}
      />
      <span aria-hidden className="absolute left-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">для своих</span>
      {image ? (
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[42%] overflow-hidden">
          <OptimizedImage
            src={image}
            alt=""
            sizes={IMAGE_SIZES.homeBanner}
            className="object-cover opacity-90 transition duration-500 group-hover:scale-[1.04]"
            quality={75}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
        </div>
      ) : null}
      <div className={cn('min-w-0', image && 'max-w-[68%]')}>
        <h2 className="relative z-[1] text-[25px] font-extrabold leading-[0.96] tracking-[-0.04em] text-white line-clamp-2">{title}</h2>
        {description ? (
          <p className="relative z-[1] mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white/75">{description}</p>
        ) : null}
      </div>
      <div className="relative z-[1] mt-3">
        <span className="inline-flex items-center rounded-full bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-950 shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
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
