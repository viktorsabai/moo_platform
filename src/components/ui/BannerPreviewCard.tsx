'use client'

import { cn } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

export type BannerPreviewCardProps = {
  type: 'chip' | 'reel'
  title: string
  description?: string | null
  image?: string | null
  cta: string
  isActive: boolean
  onToggle: () => void
  showToggle?: boolean
  className?: string
}

/**
 * Compact preview of a banner for admin list.
 * Chip = mini PromoCard, Reel = mini VerticalReelCard.
 * Toggle on card; when inactive, visually muted (opacity).
 */
export function BannerPreviewCard({
  type,
  title,
  description,
  image,
  cta,
  isActive,
  onToggle,
  showToggle = true,
  className,
}: BannerPreviewCardProps) {
  const muted = !isActive

  if (type === 'chip') {
    return (
      <div
        className={cn(
          'relative flex min-h-[88px] min-w-[240px] max-w-[280px] shrink-0 flex-col justify-between overflow-hidden p-4 transition',
          'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]',
          'shadow-[var(--shadow-soft)]',
          muted && 'opacity-55',
          className
        )}
        style={{ borderRadius: 'var(--radius-large)' }}
      >
        {image ? (
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[40%] overflow-hidden">
            <OptimizedImage
              src={image}
              alt=""
              sizes="(max-width: 480px) 40vw, 120px"
              className="object-cover"
              quality={75}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--surface-strong)] via-transparent to-transparent" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold leading-tight line-clamp-2 tracking-tight">{title}</h3>
          {description ? (
            <p className="ui-muted mt-1 line-clamp-1 text-[12px]">{description}</p>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-black/[0.08] px-3 py-2 text-[12px] font-semibold text-[color:var(--text)]">
            {cta}
          </span>
          {showToggle ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
                isActive
                  ? 'bg-black/10 text-black/70 active:opacity-80'
                  : 'bg-[color:var(--accent)] text-white active:opacity-90'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {isActive ? 'выкл' : 'вкл'}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  // reel
  return (
    <div
      className={cn(
        'relative flex h-[156px] w-[114px] shrink-0 flex-col overflow-hidden transition',
        'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]',
        'shadow-[var(--shadow-soft)]',
        image && 'p-1.5',
        muted && 'opacity-55',
        className
      )}
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      {image ? (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-[color:var(--surface)]">
          <OptimizedImage
            src={image}
            alt=""
            sizes={IMAGE_SIZES.reelCard}
            className="object-cover"
            quality={75}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/55 to-transparent" />
        </div>
      ) : null}
      <div className={cn('relative flex min-h-0 flex-col justify-end', image ? 'mt-1 rounded-[16px] bg-white/92 p-2 shadow-[0_8px_18px_rgba(0,0,0,0.08)]' : 'flex-1 p-3')}>
        <h3 className="text-[12px] font-extrabold leading-tight line-clamp-3 tracking-tight text-[color:var(--text)]">{title}</h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cn('inline-flex max-w-[64px] items-center rounded-full px-2.5 py-1.5 text-[10px] font-semibold line-clamp-1', image ? 'bg-black text-white' : 'bg-black/[0.1] text-[color:var(--text)]')}>
            {cta}
          </span>
          {showToggle ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
                isActive
                  ? 'bg-black/10 text-black/70 active:opacity-80'
                  : 'bg-[color:var(--accent)] text-white active:opacity-90'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {isActive ? 'выкл' : 'вкл'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
