import Link from 'next/link'
import type { FC, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BrandMarkOO } from '@/components/ui/BrandMarkOO'

export type ReelCardProps = {
  href?: string
  onClick?: () => void
  kicker?: ReactNode
  title: ReactNode
  cta: ReactNode
  showArrow?: boolean
  mark?: boolean
  className?: string
}

export const ReelCard: FC<ReelCardProps> = ({
  href,
  onClick,
  kicker,
  title,
  cta,
  showArrow = true,
  mark = true,
  className,
}) => {
  const content = (
    <div
      className={cn(
        // reels / shorts: tall, narrow
        'ui-surface-strong flex h-[280px] w-[200px] flex-col justify-between overflow-hidden p-4 transition active:scale-[0.99]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="ui-h1">{title}</div>
        </div>
        {mark ? (
          <div
            className="grid h-14 w-14 shrink-0 place-items-center border border-black/10 bg-white/70"
            style={{ borderRadius: 'var(--radius-medium)' }}
          >
            <BrandMarkOO />
          </div>
        ) : null}
      </div>

      <div className="inline-flex items-center self-start rounded-full bg-black/[0.04] px-3 py-2 text-[13px] font-semibold text-black/75">
        {cta}
        {showArrow ? <span aria-hidden className="ml-1 text-black/35">→</span> : null}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} prefetch={false} scroll={false} className="snap-start">
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className="snap-start text-left" aria-label="открыть">
      {content}
    </button>
  )
}

