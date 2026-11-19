'use client'

import Link from 'next/link'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { fmtThb } from '@/components/kit'
import { cn } from '@/lib/utils'

/* Витринные блоки главной: карусель акций и горизонтальные подборки блюд. */

export type PromoCard = {
  id: string
  title: string
  description?: string | null
  image?: string | null
  href: string
  cta?: string | null
  /** chip — широкая карточка, reel — вертикальная */
  type: string
}

const rail = '-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/** Карусель акций: широкие баннеры (chip) и вертикальные (reel) в одной ленте. */
export function PromoRail({ cards }: { cards: PromoCard[] }) {
  if (!cards.length) return null
  return (
    <section aria-label="акции" className={cn(rail, 'mb-5')}>
      {cards.map((c) => {
        const reel = c.type === 'reel'
        return (
          <Link
            key={c.id}
            href={c.href || '/'}
            prefetch={false}
            className={cn(
              'relative flex shrink-0 snap-start flex-col justify-end overflow-hidden rounded-[20px] p-3.5 transition active:scale-[0.98]',
              reel ? 'h-[156px] w-[112px]' : 'h-[156px] w-[82%] max-w-[320px]',
              c.image ? 'bg-[color:var(--surface)]' : 'bg-[color:var(--primary)]'
            )}
          >
            {c.image ? (
              <>
                <OptimizedImage src={c.image} alt="" sizes={reel ? '140px' : IMAGE_SIZES.homeBanner} className="object-cover" />
                {/* затемнение снизу, чтобы текст читался на любой картинке */}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </>
            ) : null}
            <span className="relative z-[1] flex flex-col gap-1">
              <span className={cn('line-clamp-2 font-bold leading-tight', reel ? 'text-[14px]' : 'text-[17px]', c.image ? 'text-white' : 'text-[color:var(--on-primary)]')}>
                {c.title}
              </span>
              {c.description && !reel ? (
                <span className={cn('line-clamp-1 text-[12.5px]', c.image ? 'text-white/85' : 'text-[color:var(--on-primary)] opacity-80')}>{c.description}</span>
              ) : null}
              {c.cta && !reel ? (
                <span
                  className={cn('mt-1 inline-flex h-8 w-fit items-center rounded-full px-3 text-[12.5px] font-semibold', !c.image && 'bg-[color:var(--on-primary)] text-[color:var(--primary)]')}
                  style={c.image ? { background: '#fff', color: '#111' } : undefined}
                >
                  {c.cta}
                </span>
              ) : null}
            </span>
          </Link>
        )
      })}
    </section>
  )
}

export type RailDish = {
  key: string
  name: string
  price: number
  image?: string
  weightLabel?: string
  off: boolean
  /** сколько уже в корзине */
  qty: number
}

/** Горизонтальная подборка: «Хиты», «Новинки». Кнопка «+» добавляет сразу или открывает шторку. */
export function DishRail({
  title,
  items,
  onOpen,
  onAdd,
}: {
  title: string
  items: RailDish[]
  onOpen: (key: string) => void
  onAdd: (key: string) => void
}) {
  if (items.length < 2) return null
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-[19px] font-bold tracking-tight text-[color:var(--text)]">{title}</h2>
      <div className={rail}>
        {items.map((it) => (
          <article key={it.key} className={cn('relative w-[148px] shrink-0 snap-start', it.off && 'opacity-60')}>
            <button type="button" onClick={() => onOpen(it.key)} className="block w-full text-left" aria-label={it.name}>
              <span className="relative block aspect-square w-full overflow-hidden rounded-[18px] bg-[color:var(--surface)]">
                {it.image ? <OptimizedImage src={it.image} alt="" sizes="160px" className="object-cover" /> : null}
              </span>
              <span className="mt-1.5 block text-[15px] font-bold text-[color:var(--text)]">{fmtThb(it.price)}</span>
              <span className="line-clamp-2 block text-[13.5px] leading-tight text-[color:var(--text)]">{it.name}</span>
              {it.weightLabel ? <span className="mt-0.5 block text-[12px] text-[color:var(--muted)]">{it.weightLabel}</span> : null}
            </button>
            {!it.off ? (
              <button
                type="button"
                onClick={() => onAdd(it.key)}
                aria-label={`добавить ${it.name}`}
                className={cn(
                  'absolute right-1.5 top-[calc(148px-46px)] flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-[15px] font-bold shadow-[var(--shadow-card)] transition active:scale-95',
                  it.qty > 0 ? 'bg-[color:var(--primary)] text-[color:var(--on-primary)]' : 'bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                )}
              >
                {it.qty > 0 ? it.qty : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-5 w-5" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
                )}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
