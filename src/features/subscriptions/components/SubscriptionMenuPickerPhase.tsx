'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import { formatGuestPeriodBadge } from '@/lib/subscription-offer-labels'
import type { SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { IconChevronUp } from '@/components/ui/icons'

type Props = {
  dishes: Dish[]
  lines: SelectedLine[]
  activeSlot: MealSlot
  enabledSlots: MealSlot[]
  slotStepIndex: number
  recommendedDishIds: string[]
  subConfig: SubscriptionConfig
  perDeliveryEstimate: number
  onActiveSlot: (slot: MealSlot) => void
  onAddDish: (dishId: string) => void
  onContinue: () => void
}

function CompactDishRow({
  dish,
  selected,
  highlight,
  onAdd,
}: {
  dish: Dish
  selected: boolean
  highlight?: boolean
  onAdd: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'flex w-full items-center gap-3 rounded-[var(--radius-medium)] border px-2 py-2 text-left transition active:scale-[0.99]',
        selected
          ? 'border-[color:var(--text)] bg-[color:var(--text)]/5'
          : highlight
            ? 'border-[color:var(--accent)]/40 bg-[color:var(--accent)]/5'
            : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
        {dish.image ? (
          <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
        ) : (
          <span className="flex h-full items-center justify-center text-[24px]">🍽</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{dish.name}</p>
        <p className="text-[12px] font-bold tabular-nums text-[color:var(--muted)]">{formatPrice(dish.price)}</p>
      </div>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-light',
          selected ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
        )}
      >
        {selected ? '✓' : '+'}
      </span>
    </button>
  )
}

export function SubscriptionMenuPickerPhase({
  dishes,
  lines,
  activeSlot,
  enabledSlots,
  slotStepIndex,
  recommendedDishIds,
  subConfig,
  perDeliveryEstimate,
  onActiveSlot,
  onAddDish,
  onContinue,
}: Props) {
  const recommended = dishes.filter((d) => recommendedDishIds.includes(d.id))
  const rest = dishes.filter((d) => !recommendedDishIds.includes(d.id))
  const linesInSlot = lines.filter((l) => l.mealSlot === activeSlot)
  const slotComplete = linesInSlot.length > 0
  const defaultPeriod = subConfig.defaultPeriodDays ?? 28
  const guestBadge = formatGuestPeriodBadge(subConfig.commerce, subConfig.periodDiscounts, defaultPeriod)

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+88px)]">
      <PageHeader
        backHref="/subscriptions"
        title="соберите рацион"
        subtitle={
          enabledSlots.length > 1
            ? `шаг ${slotStepIndex + 1} из ${enabledSlots.length} · ${MEAL_SLOT_LABEL[activeSlot]}`
            : MEAL_SLOT_LABEL[activeSlot]
        }
      />

      {guestBadge ? (
        <p className="mb-3 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[12px] text-[color:var(--muted)]">
          подписка от <span className="font-bold text-[color:var(--text)]">{guestBadge}</span> с учётом периода и вашего
          рациона
        </p>
      ) : null}

      {enabledSlots.length > 1 ? (
        <div className="mb-4 flex gap-1.5">
          {enabledSlots.map((s, i) => {
            const done = lines.some((l) => l.mealSlot === s)
            const current = s === activeSlot
            return (
              <button
                key={s}
                type="button"
                onClick={() => onActiveSlot(s)}
                className={cn(
                  'flex-1 rounded-full py-2 text-[11px] font-bold capitalize transition',
                  current
                    ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                    : done
                      ? 'border border-[color:var(--text)] text-[color:var(--text)]'
                      : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
                )}
              >
                {MEAL_SLOT_LABEL[s]}
              </button>
            )
          })}
        </div>
      ) : null}

      {recommended.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-2 text-[13px] font-extrabold text-[color:var(--muted)]">рекомендуем</h2>
          <ul className="space-y-2">
            {recommended.map((d) => (
              <li key={d.id}>
                <CompactDishRow
                  dish={d}
                  highlight
                  selected={lines.some((l) => l.dishId === d.id && l.mealSlot === activeSlot)}
                  onAdd={() => onAddDish(d.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-2 text-[13px] font-extrabold text-[color:var(--muted)]">
            {recommended.length > 0 ? 'ещё в меню' : 'выберите блюдо'}
          </h2>
          <ul className="space-y-2">
            {rest.map((d) => (
              <li key={d.id}>
                <CompactDishRow
                  dish={d}
                  selected={lines.some((l) => l.dishId === d.id && l.mealSlot === activeSlot)}
                  onAdd={() => onAddDish(d.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dishes.length === 0 ? (
        <div className="ui-surface-card py-10 text-center">
          <p className="text-[15px] font-bold">меню пока пустое</p>
          <p className="mt-1 text-[13px] text-[color:var(--muted)]">заведение ещё не собрало каталог подписки</p>
        </div>
      ) : null}

      <div
        className="fixed left-0 right-0 z-[110] px-3"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="ui-sticky-sheet flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold">
              {lines.length} в рационе
              {!slotComplete ? ` · выберите ${MEAL_SLOT_LABEL[activeSlot]}` : ''}
            </p>
            {perDeliveryEstimate > 0 ? (
              <p className="text-[11px] font-semibold text-[color:var(--muted)] tabular-nums">
                ~{formatPrice(perDeliveryEstimate)} за доставку
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={lines.length === 0}
            className="btn btn-primary inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-5 text-[14px] font-bold disabled:opacity-40"
          >
            {enabledSlots.length > 1 && slotStepIndex < enabledSlots.length - 1 ? 'далее' : 'оформить'}
            <IconChevronUp className="h-4 w-4 rotate-90" />
          </button>
        </div>
      </div>
    </main>
  )
}
