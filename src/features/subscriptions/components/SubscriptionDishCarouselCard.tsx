'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

type Props = {
  dish: Dish
  selected: boolean
  hasOptions?: boolean
  onPress: () => void
}

export function SubscriptionDishCarouselCard({ dish, selected, hasOptions, onPress }: Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'flex w-[118px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-medium)] border text-left transition active:scale-[0.98]',
        selected ? 'border-[color:var(--text)] shadow-[0_0_0_1px_var(--text)]' : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-black/[0.04]">
        {dish.image ? (
          <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.checkoutThumb} />
        ) : (
          <span className="flex h-full items-center justify-center text-[28px]">🍽</span>
        )}
        <span
          className={cn(
            'absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-light shadow-sm',
            selected ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'bg-[color:var(--surface)] text-[color:var(--muted)]'
          )}
        >
          {selected ? '✓' : '+'}
        </span>
      </div>
      <div className="px-2 py-1.5">
        <p className="line-clamp-2 min-h-[2.5em] text-[11px] font-semibold leading-tight">{dish.name}</p>
        <p className="mt-0.5 text-[11px] font-bold tabular-nums text-[color:var(--muted)]">
          {formatPrice(dish.price)}
          {hasOptions ? ' · ⚙' : ''}
        </p>
      </div>
    </button>
  )
}
