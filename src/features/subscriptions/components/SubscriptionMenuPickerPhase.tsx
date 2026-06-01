'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { tagLabel } from '@/lib/tag-labels'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import {
  TAG_FILTERS,
  type MenuCategory,
  type SelectedLine,
  dishMatchesTagFilter,
  primaryDishTag,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { IconChevronUp } from '@/components/ui/icons'

type Props = {
  categories: MenuCategory[]
  dishes: Dish[]
  dishesByCategory: Record<string, Dish[]>
  lines: SelectedLine[]
  categoryFilter: string
  tagFilter: string
  activeSlot: MealSlot | 'all'
  enabledSlots: MealSlot[]
  subConfig: SubscriptionConfig
  perDeliveryEstimate: number
  onCategoryFilter: (id: string) => void
  onTagFilter: (id: string) => void
  onActiveSlot: (slot: MealSlot | 'all') => void
  onAddDish: (dishId: string) => void
  onContinue: () => void
}

function SubscriptionDishTile({
  dish,
  selected,
  onAdd,
}: {
  dish: Dish
  selected: boolean
  onAdd: () => void
}) {
  const badge = primaryDishTag(dish.tags)
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-large)] border bg-[color:var(--surface)] shadow-[var(--shadow-soft)]',
        selected ? 'border-[color:var(--text)]' : 'border-[color:var(--stroke)]'
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-black/[0.04]">
        {dish.image ? (
          <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.menuGrid} />
        ) : (
          <div className="flex h-full items-center justify-center text-[32px]">🍽</div>
        )}
        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-[color:var(--surface-strong)]/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--text)] shadow-sm">
            {tagLabel(badge)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            'absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-[20px] font-light shadow-md transition active:scale-95',
            selected
              ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
              : 'bg-[color:var(--surface-strong)] text-[color:var(--text)]'
          )}
          aria-label={selected ? 'уже в рационе' : 'добавить'}
        >
          {selected ? '✓' : '+'}
        </button>
      </div>
      <div className="p-3">
        <p className="line-clamp-1 text-[15px] font-bold leading-tight">{dish.name}</p>
        {dish.description ? (
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[color:var(--muted)]">{dish.description}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          {dish.calories != null ? (
            <span className="text-[11px] font-semibold text-[color:var(--muted)]">{dish.calories} ккал</span>
          ) : (
            <span />
          )}
          <span className="text-[13px] font-extrabold tabular-nums">{formatPrice(dish.price)}</span>
        </div>
      </div>
    </div>
  )
}

export function SubscriptionMenuPickerPhase({
  categories,
  dishes,
  dishesByCategory,
  lines,
  categoryFilter,
  tagFilter,
  activeSlot,
  enabledSlots,
  subConfig,
  perDeliveryEstimate,
  onCategoryFilter,
  onTagFilter,
  onActiveSlot,
  onAddDish,
  onContinue,
}: Props) {
  const filtered = dishes.filter((d) => {
    if (categoryFilter !== 'all' && d.categoryId !== categoryFilter) return false
    if (!dishMatchesTagFilter(d, tagFilter)) return false
    if (activeSlot !== 'all') {
      const allowed = new Set(subConfig.mealSlots[activeSlot]?.dishIds ?? [])
      if (!allowed.has(d.id)) return false
    }
    return true
  })

  const popular = filtered.filter((d) => (d.tags ?? []).some((t) => ['hit', 'popular', 'chef-choice'].includes(t)))

  const categorySections =
    categoryFilter === 'all'
      ? categories
          .map((c) => ({ category: c, items: filtered.filter((d) => d.categoryId === c.id) }))
          .filter((s) => s.items.length > 0)
      : [{ category: categories.find((c) => c.id === categoryFilter) ?? { id: categoryFilter, name: 'меню', slug: '' }, items: filtered }]

  const uniqueThumbIds = [...new Set(lines.map((l) => l.dishId))].slice(0, 4)

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+88px)]">
      <PageHeader backHref="/subscriptions" title="соберите свой рацион" subtitle="выбирайте блюда из меню" />

      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onCategoryFilter('all')}
          className={cn(
            'flex shrink-0 flex-col items-center gap-1 rounded-[var(--radius-medium)] border px-3 py-2 min-w-[64px]',
            categoryFilter === 'all'
              ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]'
              : 'border-[color:var(--stroke)]'
          )}
        >
          <span className="text-[18px]">🍽</span>
          <span className="text-[11px] font-bold">всё</span>
        </button>
        {categories.map((c) => {
          const count = dishesByCategory[c.id]?.length ?? 0
          if (count === 0) return null
          const active = categoryFilter === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategoryFilter(c.id)}
              className={cn(
                'flex shrink-0 flex-col items-center gap-1 rounded-[var(--radius-medium)] border px-3 py-2 min-w-[64px]',
                active
                  ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]'
                  : 'border-[color:var(--stroke)]'
              )}
            >
              <span className="text-[18px]">{c.emoji || '🍛'}</span>
              <span className="max-w-[72px] truncate text-[11px] font-bold">{c.name}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TAG_FILTERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTagFilter(t.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[12px] font-semibold',
              tagFilter === t.id
                ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]'
                : 'border-[color:var(--stroke)] text-[color:var(--muted)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {enabledSlots.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onActiveSlot('all')}
            className={cn(
              'rounded-full px-3 py-1.5 text-[12px] font-semibold',
              activeSlot === 'all' ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
            )}
          >
            весь день
          </button>
          {enabledSlots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onActiveSlot(s)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize',
                activeSlot === s ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
              )}
            >
              {MEAL_SLOT_LABEL[s]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-8">
        {categoryFilter === 'all' && popular.length > 0 ? (
          <section>
            <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">популярное</h2>
            <div className="grid grid-cols-2 gap-3">
              {popular.map((d) => (
                <SubscriptionDishTile
                  key={d.id}
                  dish={d}
                  selected={lines.some((l) => l.dishId === d.id)}
                  onAdd={() => onAddDish(d.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {categorySections.map(({ category, items }) => {
          const showItems =
            categoryFilter === 'all'
              ? items.filter((d) => !popular.some((p) => p.id === d.id))
              : items
          if (showItems.length === 0) return null
          return (
            <section key={category.id}>
              <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">{category.name}</h2>
              <div className="grid grid-cols-2 gap-3">
                {showItems.map((d) => (
                  <SubscriptionDishTile
                    key={d.id}
                    dish={d}
                    selected={lines.some((l) => l.dishId === d.id)}
                    onAdd={() => onAddDish(d.id)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {lines.length > 0 ? (
        <div
          className="fixed left-0 right-0 z-[110] px-3"
          style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom) + 8px)' }}
        >
          <div className="ui-sticky-sheet flex items-center gap-3 p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex -space-x-2">
                {uniqueThumbIds.map((id) => {
                  const dish = dishes.find((d) => d.id === id)
                  return (
                    <div
                      key={id}
                      className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-medium)] border-2 border-[color:var(--surface-strong)] bg-black/5"
                    >
                      {dish?.image ? (
                        <OptimizedImage src={dish.image} alt="" className="object-cover" sizes="40px" />
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold">{lines.length} блюд</p>
                <p className="text-[11px] font-semibold text-[color:var(--muted)] tabular-nums">
                  ~{formatPrice(perDeliveryEstimate)} за доставку
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onContinue}
              className="btn btn-primary inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-5 text-[14px] font-bold"
            >
              далее
              <IconChevronUp className="h-4 w-4 rotate-90" />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
