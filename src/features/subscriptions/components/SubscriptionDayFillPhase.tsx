'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconChevronLeft } from '@/components/ui/icons'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import type { PeriodQuote, SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { WEEKDAYS, wizardDayToJs } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { IconChevronUp } from '@/components/ui/icons'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'
import { SubscriptionPeriodCards } from '@/features/subscriptions/components/SubscriptionPeriodCards'

type Props = {
  selectedDays: number[]
  activeWizardDay: number
  activeSlot: MealSlot
  enabledSlots: MealSlot[]
  allDishes: Dish[]
  pickerDishes: Dish[]
  lines: SelectedLine[]
  recommendedDishIds: string[]
  subConfig: SubscriptionConfig
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  periodDays: number
  onWizardDay: (d: number) => void
  onActiveSlot: (s: MealSlot) => void
  onPeriodDays: (d: number) => void
  onAddDish: (dishId: string) => void
  onCopyDayFrom: (fromWizardDay: number) => void
  onBack: () => void
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

function dayComplete(lines: SelectedLine[], wizardDay: number, slots: MealSlot[]) {
  const js = wizardDayToJs(wizardDay)
  return slots.every((slot) => lines.some((l) => l.dayOfWeek === js && l.mealSlot === slot))
}

export function SubscriptionDayFillPhase({
  selectedDays,
  activeWizardDay,
  activeSlot,
  enabledSlots,
  allDishes,
  pickerDishes,
  lines,
  recommendedDishIds,
  subConfig,
  quotesByPeriod,
  periodDays,
  onWizardDay,
  onActiveSlot,
  onPeriodDays,
  onAddDish,
  onCopyDayFrom,
  onBack,
  onContinue,
}: Props) {
  const jsDay = wizardDayToJs(activeWizardDay)
  const recommended = pickerDishes.filter((d) => recommendedDishIds.includes(d.id))
  const rest = pickerDishes.filter((d) => !recommendedDishIds.includes(d.id))
  const allComplete = selectedDays.every((d) => dayComplete(lines, d, enabledSlots))
  const activeQuote = quotesByPeriod[periodDays]
  const periods = subConfig.availablePeriods ?? [7, 14, 28]
  const prevDayIdx = selectedDays.indexOf(activeWizardDay)
  const prevWizardDay = prevDayIdx > 0 ? selectedDays[prevDayIdx - 1] : null

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+96px)]">
      <div className="mb-2 flex items-start gap-2">
        <button type="button" onClick={onBack} className="ui-back-button mt-1 shrink-0" aria-label="назад к подпискам">
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <PageHeader
          title={`меню · ${WEEKDAYS[activeWizardDay]}`}
          subtitle="шаг 2 · блюда на этот день"
          compact
          className="min-w-0 flex-1"
        />
      </div>

      <SubscriptionFlowProgress step="fill" />

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {selectedDays.map((d) => {
          const done = dayComplete(lines, d, enabledSlots)
          const current = d === activeWizardDay
          return (
            <button
              key={d}
              type="button"
              onClick={() => onWizardDay(d)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold transition',
                current
                  ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                  : done
                    ? 'border border-[color:var(--primary)] text-[color:var(--primary)]'
                    : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
              )}
            >
              {WEEKDAYS[d]}
              {done ? ' ✓' : ''}
            </button>
          )
        })}
      </div>

      {prevWizardDay != null && !dayComplete(lines, activeWizardDay, enabledSlots) ? (
        <button
          type="button"
          onClick={() => onCopyDayFrom(prevWizardDay)}
          className="mb-3 w-full rounded-full border border-dashed border-[color:var(--stroke)] py-2 text-[12px] font-semibold text-[color:var(--muted)]"
        >
          как в {WEEKDAYS[prevWizardDay]} — скопировать
        </button>
      ) : null}

      {enabledSlots.length > 1 ? (
        <div className="mb-3 flex gap-1.5">
          {enabledSlots.map((s) => {
            const has = lines.some((l) => l.dayOfWeek === jsDay && l.mealSlot === s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => onActiveSlot(s)}
                className={cn(
                  'flex-1 rounded-full py-2 text-[11px] font-bold capitalize',
                  activeSlot === s
                    ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                    : has
                      ? 'border border-[color:var(--text)]'
                      : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
                )}
              >
                {MEAL_SLOT_LABEL[s]}
              </button>
            )
          })}
        </div>
      ) : null}

      <ul className="mb-4 space-y-2">
        {recommended.map((d) => (
          <li key={d.id}>
            <CompactDishRow
              dish={d}
              highlight
              selected={lines.some((l) => l.dishId === d.id && l.dayOfWeek === jsDay && l.mealSlot === activeSlot)}
              onAdd={() => onAddDish(d.id)}
            />
          </li>
        ))}
        {rest.map((d) => (
          <li key={d.id}>
            <CompactDishRow
              dish={d}
              selected={lines.some((l) => l.dishId === d.id && l.dayOfWeek === jsDay && l.mealSlot === activeSlot)}
              onAdd={() => onAddDish(d.id)}
            />
          </li>
        ))}
      </ul>

      {allComplete && activeQuote && activeQuote.guestSavingsPercent > 0 ? (
        <div className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-3 py-3">
          <p className="text-[12px] font-semibold text-[color:var(--muted)]">выгода с подпиской</p>
          <p className="text-[18px] font-extrabold">−{Math.round(activeQuote.guestSavingsPercent)}%</p>
        </div>
      ) : null}

      {allComplete ? (
        <section className="mb-4">
          <h3 className="mb-2 text-[13px] font-extrabold">период</h3>
          <SubscriptionPeriodCards
            config={subConfig}
            periods={periods}
            quotesByPeriod={quotesByPeriod}
            selectedPeriodDays={periodDays}
            onSelect={onPeriodDays}
            compact
          />
        </section>
      ) : null}

      <div
        className="fixed left-0 right-0 z-[110] px-3"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="ui-sticky-sheet flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold">{allComplete ? 'все дни заполнены' : `заполните ${WEEKDAYS[activeWizardDay]}`}</p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!allComplete}
            className="btn btn-primary inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-5 text-[14px] font-bold disabled:opacity-40"
          >
            к оплате
            <IconChevronUp className="h-4 w-4 rotate-90" />
          </button>
        </div>
      </div>
    </main>
  )
}
