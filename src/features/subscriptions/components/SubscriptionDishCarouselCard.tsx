'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

type Props = {
  dish: Dish
  selected: boolean
  hasOptions: boolean
  optionsSummary?: string | null
  needsOptions?: boolean
  onAdd: () => void
  onRemove?: () => void
  onOpenOptions?: () => void
}

export function SubscriptionDishCarouselCard({
  dish,
  selected,
  hasOptions,
  optionsSummary,
  needsOptions,
  onAdd,
  onRemove,
  onOpenOptions,
}: Props) {
  return (
    <div
      className={cn(
        'relative flex w-[132px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-large)] border bg-[color:var(--surface)]',
        selected ? 'border-[color:var(--text)] ring-1 ring-[color:var(--text)]' : 'border-[color:var(--stroke)]'
      )}
    >
      <button type="button" onClick={() => (!selected ? onAdd() : undefined)} className="flex flex-col text-left active:opacity-95">
        <div className="relative h-[108px] w-full bg-black/[0.04]">
          {dish.image ? (
            <OptimizedImage src={dish.image} alt="" className="h-full w-full object-cover" sizes={IMAGE_SIZES.cartRow} />
          ) : (
            <span className="flex h-full items-center justify-center text-[36px]">🍽</span>
          )}
          {hasOptions ? (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-[color:var(--surface-strong)]/95 px-1.5 py-0.5 text-[9px] font-bold shadow-sm">
              опции
            </span>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (selected) onRemove?.()
              else onAdd()
            }}
            className={cn(
              'absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-light shadow-md',
              selected ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'bg-[color:var(--surface)] text-[color:var(--text)]'
            )}
            aria-label={selected ? 'убрать блюдо' : 'добавить блюдо'}
          >
            {selected ? '✕' : '+'}
          </button>
        </div>
        <div className="px-2 pb-2 pt-1.5">
          <p className="line-clamp-2 text-[12px] font-bold leading-tight">{dish.name}</p>
          <p className="mt-0.5 text-[12px] font-extrabold tabular-nums">{formatPrice(dish.price)}</p>
          {selected && optionsSummary ? (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-[color:var(--muted)]">{optionsSummary}</p>
          ) : null}
          {selected && needsOptions ? (
            <p className="mt-0.5 text-[10px] font-bold text-[color:var(--accent)]">выберите опции</p>
          ) : null}
        </div>
      </button>
      {selected ? (
        <div className="mx-2 mb-2 flex flex-col gap-1">
          {hasOptions && onOpenOptions ? (
            <button
              type="button"
              onClick={onOpenOptions}
              className="rounded-full border border-[color:var(--text)] bg-[color:var(--text)] py-1.5 text-[10px] font-bold text-[color:var(--surface)]"
            >
              {optionsSummary ? 'изменить опции' : 'выбрать опции'}
            </button>
          ) : null}
          {onRemove ? (
            <button type="button" onClick={onRemove} className="py-1 text-[10px] font-bold text-red-600">
              убрать
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
