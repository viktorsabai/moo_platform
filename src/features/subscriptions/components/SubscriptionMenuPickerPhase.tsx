'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import type { PeriodQuote, SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { IconChevronUp } from '@/components/ui/icons'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'
import { SubscriptionPeriodCards } from '@/features/subscriptions/components/SubscriptionPeriodCards'

type Props = {
  /** Все блюда каталога — для строк «завтрак / обед». */
  allDishes: Dish[]
  /** Блюда активного слота — список выбора. */
  pickerDishes: Dish[]
  lines: SelectedLine[]
  activeSlot: MealSlot
  enabledSlots: MealSlot[]
  recommendedDishIds: string[]
  subConfig: SubscriptionConfig
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  periodDays: number
  selectedDays: number[]
  onPeriodDays: (days: number) => void
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
  allDishes,
  pickerDishes,
  lines,
  activeSlot,
  enabledSlots,
  recommendedDishIds,
  subConfig,
  quotesByPeriod,
  periodDays,
  selectedDays,
  onPeriodDays,
  perDeliveryEstimate,
  onActiveSlot,
  onAddDish,
  onContinue,
}: Props) {
  const recommended = pickerDishes.filter((d) => recommendedDishIds.includes(d.id))
  const rest = pickerDishes.filter((d) => !recommendedDishIds.includes(d.id))
  const allSlotsComplete = enabledSlots.every((s) => lines.some((l) => l.mealSlot === s))
  const activeQuote = quotesByPeriod[periodDays]
  const periods = subConfig.availablePeriods ?? [7, 14, 28]

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+96px)]">
      <PageHeader backHref="/" title="подписка на доставку" subtitle="готовый рацион · фикс цена за период" />

      <SubscriptionFlowProgress step="fill" />

      <div className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--primary)]/25 bg-[color:var(--primary)]/8 px-3 py-2.5 text-[12px] leading-snug text-[color:var(--text)]">
        <strong>Как это работает:</strong> выбираете блюда на завтрак / обед — в{' '}
        <span className="font-semibold">каждый день доставки</span> привозим тот же набор. Не нужно собирать меню на
        каждый день отдельно.
      </div>

      {enabledSlots.length > 1 ? (
        <section className="mb-4">
          <h2 className="mb-2 text-[13px] font-extrabold text-[color:var(--muted)]">ваш рацион</h2>
          <ul className="space-y-2">
            {enabledSlots.map((slot) => {
              const pick = lines.find((l) => l.mealSlot === slot)
              const dish = pick ? allDishes.find((d) => d.id === pick.dishId) : null
              const done = Boolean(pick)
              return (
                <li key={slot}>
                  <button
                    type="button"
                    onClick={() => onActiveSlot(slot)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--radius-medium)] border px-3 py-2.5 text-left',
                      activeSlot === slot ? 'border-[color:var(--text)]' : 'border-[color:var(--stroke)]'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        done ? 'bg-[color:var(--primary)] text-white' : 'border border-[color:var(--stroke)]'
                      )}
                    >
                      {done ? '✓' : '·'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold capitalize">{MEAL_SLOT_LABEL[slot]}</p>
                      <p className="truncate text-[12px] text-[color:var(--muted)]">
                        {dish ? dish.name : 'нажмите, чтобы выбрать'}
                      </p>
                    </div>
                    <span className="text-[12px] font-semibold text-[color:var(--primary)]">
                      {activeSlot === slot ? 'меняю' : 'изменить'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="mb-4">
        <h2 className="mb-1 text-[14px] font-extrabold">
          {enabledSlots.length > 1 ? `${MEAL_SLOT_LABEL[activeSlot]} · выбор блюда` : 'выберите блюдо'}
        </h2>
        <p className="mb-2 text-[11px] text-[color:var(--muted)]">рекомендации заведения — можно заменить одним тапом</p>

        {recommended.length > 0 ? (
          <ul className="mb-3 space-y-2">
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
        ) : null}

        {rest.length > 0 ? (
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
        ) : null}

        {pickerDishes.length === 0 ? (
          <div className="ui-surface-card py-10 text-center">
            <p className="text-[15px] font-bold">меню пока пустое</p>
            <p className="mt-1 text-[13px] text-[color:var(--muted)]">заведение ещё не собрало каталог подписки</p>
          </div>
        ) : null}
      </section>

      {lines.length > 0 && activeQuote && activeQuote.guestSavingsPercent > 0 ? (
        <div className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-3 py-3">
          <p className="text-[12px] font-semibold text-[color:var(--muted)]">ваша выгода</p>
          <p className="mt-1 text-[18px] font-extrabold tabular-nums text-[color:var(--text)]">
            −{Math.round(activeQuote.guestSavingsPercent)}% vs разовые заказы
          </p>
          <p className="mt-1 text-[11px] text-[color:var(--muted)]">
            ~{formatPrice(perDeliveryEstimate)} за доставку · {selectedDays.length} дн. в неделю
          </p>
        </div>
      ) : null}

      {allSlotsComplete && lines.length > 0 ? (
        <section className="mb-4">
          <h3 className="mb-2 text-[13px] font-extrabold">ориентир по периоду</h3>
          <SubscriptionPeriodCards
            config={subConfig}
            periods={periods}
            quotesByPeriod={quotesByPeriod}
            selectedPeriodDays={periodDays}
            onSelect={onPeriodDays}
            compact
          />
          <p className="mt-2 text-[11px] text-[color:var(--muted)]">точную сумму увидите на следующем шаге</p>
        </section>
      ) : null}

      <div
        className="fixed left-0 right-0 z-[110] px-3"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="ui-sticky-sheet flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold">
              {allSlotsComplete ? 'рацион готов' : `${lines.length} в рационе · доберите слоты`}
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
            disabled={!allSlotsComplete}
            className="btn btn-primary inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-5 text-[14px] font-bold disabled:opacity-40"
          >
            дни и оплата
            <IconChevronUp className="h-4 w-4 rotate-90" />
          </button>
        </div>
      </div>
    </main>
  )
}
