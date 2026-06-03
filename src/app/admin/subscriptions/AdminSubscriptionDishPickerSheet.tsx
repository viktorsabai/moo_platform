'use client'

import { useMemo, useState } from 'react'
import { cn, formatPrice } from '@/lib/utils'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import type { CatalogProduct } from './AdminSubscriptionDashboard'

type MenuCategory = { id: string; name: string; emoji?: string | null }

type Props = {
  open: boolean
  slot: MealSlot
  dishes: CatalogProduct[]
  categories: MenuCategory[]
  selectedIds: Set<string>
  onClose: () => void
  onToggle: (dish: CatalogProduct) => void
}

export function AdminSubscriptionDishPickerSheet({
  open,
  slot,
  dishes,
  categories,
  selectedIds,
  onClose,
  onToggle,
}: Props) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return dishes.filter((d) => {
      if (categoryId !== 'all' && d.categoryId !== categoryId) return false
      if (!q) return true
      return d.name.toLowerCase().includes(q)
    })
  }, [dishes, query, categoryId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/45" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0" aria-label="закрыть" onClick={onClose} />
      <div className="relative max-h-[85dvh] rounded-t-[var(--radius-large)] bg-[color:var(--surface-strong)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[color:var(--stroke)] px-4 py-3">
          <div>
            <p className="text-[15px] font-bold">добавить в {MEAL_SLOT_LABEL[slot]}</p>
            <p className="text-[12px] text-[color:var(--muted)]">отметьте блюда · закройте лист</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-soft h-9 rounded-full px-4 text-[13px] font-semibold">
            готово
          </button>
        </div>

        <div className="space-y-2 border-b border-[color:var(--stroke)] px-4 py-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="поиск блюда"
            className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-transparent px-3 py-2 text-[14px]"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategoryId('all')}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold',
                categoryId === 'all' ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'bg-black/[0.06]'
              )}
            >
              всё
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold whitespace-nowrap',
                  categoryId === c.id ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'bg-black/[0.06]'
                )}
              >
                {c.emoji ? `${c.emoji} ` : ''}
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <ul className="max-h-[52dvh] overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-[color:var(--muted)]">ничего не найдено</li>
          ) : (
            filtered.map((dish) => {
              const on = selectedIds.has(dish.id)
              return (
                <li key={dish.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(dish)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--radius-medium)] px-2 py-2 text-left transition',
                      on ? 'bg-[color:var(--primary)]/10' : 'hover:bg-black/[0.03]'
                    )}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
                      {dish.image ? (
                        <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[22px]">{dish.emoji || '🍽'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{dish.name}</p>
                      <p className="text-[11px] text-[color:var(--muted)] tabular-nums">{formatPrice(dish.price)}</p>
                    </div>
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
                        on ? 'bg-[color:var(--primary)] text-white' : 'border border-[color:var(--stroke)]'
                      )}
                    >
                      {on ? '✓' : '+'}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
