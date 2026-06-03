'use client'

import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { IconChevronLeft, IconChevronUp } from '@/components/ui/icons'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import { itemsPerDeliveryBySlot } from '@/lib/subscription-meal-slot-rules'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import type { PeriodQuote, SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { WEEKDAYS, wizardDayToJs } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'

type Props = {
  selectedDays: number[]
  activeWizardDay: number
  activeSlot: MealSlot
  enabledSlots: MealSlot[]
  pickerDishes: Dish[]
  lines: SelectedLine[]
  recommendedDishIds: string[]
  subConfig: SubscriptionConfig
  minDays: number
  maxDays: number
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  periodDays: number
  onDayCell: (wizardDay: number) => void
  onActiveSlot: (s: MealSlot) => void
  onAddDish: (dishId: string) => void
  onRemoveLine: (line: SelectedLine) => void
  onCopyToAllWeek: () => void
  onClearDay: () => void
  onContinue: () => void
  onOpenPay?: () => void
}

function slotHasItems(lines: SelectedLine[], jsDay: number, slot: MealSlot) {
  return lines.some((l) => l.dayOfWeek === jsDay && l.mealSlot === slot)
}

function dayComplete(lines: SelectedLine[], wizardDay: number, slots: MealSlot[]) {
  const js = wizardDayToJs(wizardDay)
  return slots.every((slot) => slotHasItems(lines, js, slot))
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
        'flex w-full items-center gap-3 rounded-[var(--radius-medium)] border px-2.5 py-2 text-left transition active:scale-[0.99]',
        selected
          ? 'border-[color:var(--text)] bg-[color:var(--text)]/[0.04]'
          : highlight
            ? 'border-[color:var(--accent)]/35 bg-[color:var(--accent)]/[0.06]'
            : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
      )}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
        {dish.image ? (
          <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
        ) : (
          <span className="flex h-full items-center justify-center text-[20px]">🍽</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight">{dish.name}</p>
        <p className="text-[12px] font-bold tabular-nums text-[color:var(--muted)]">{formatPrice(dish.price)}</p>
      </div>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-light',
          selected ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
        )}
      >
        {selected ? '✓' : '+'}
      </span>
    </button>
  )
}

export function SubscriptionBuildPhase({
  selectedDays,
  activeWizardDay,
  activeSlot,
  enabledSlots,
  pickerDishes,
  lines,
  recommendedDishIds,
  subConfig,
  minDays,
  maxDays,
  quotesByPeriod,
  periodDays,
  onDayCell,
  onActiveSlot,
  onAddDish,
  onRemoveLine,
  onCopyToAllWeek,
  onClearDay,
  onContinue,
  onOpenPay,
}: Props) {
  const jsDay = wizardDayToJs(activeWizardDay)
  const recommended = pickerDishes.filter((d) => recommendedDishIds.includes(d.id))
  const rest = pickerDishes.filter((d) => !recommendedDishIds.includes(d.id))
  const daysOk = selectedDays.length >= minDays
  const allComplete = daysOk && selectedDays.every((d) => dayComplete(lines, d, enabledSlots))
  const activeQuote = quotesByPeriod[periodDays]
  const activeDayComplete = dayComplete(lines, activeWizardDay, enabledSlots)

  const slotLines = lines.filter((l) => l.dayOfWeek === jsDay && l.mealSlot === activeSlot)
  const slotQty = itemsPerDeliveryBySlot(slotLines)[activeSlot] ?? 0
  const maxSlot = subConfig.mealSlots[activeSlot]?.maxItemsPerDelivery ?? 0
  const maxForSlot = maxSlot <= 0 ? 999 : maxSlot
  const hasTemplateForWeek = slotLines.length > 0 || lines.some((l) => l.dayOfWeek === jsDay)

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+92px)]">
      <div className="mb-1 flex items-start gap-2">
        <a href="/subscriptions" className="ui-back-button mt-1 shrink-0" aria-label="назад">
          <IconChevronLeft className="h-5 w-5" />
        </a>
        <PageHeader title="соберите рацион" subtitle="тап по дню → приём → блюда" compact className="min-w-0 flex-1" />
      </div>

      <SubscriptionFlowProgress step="build" onStep={(s) => s === 'pay' && allComplete && onOpenPay?.()} payEnabled={allComplete} />

      <section className="mb-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
          дни · {selectedDays.length} из {minDays}–{maxDays}
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label, idx) => {
            const isDelivery = selectedDays.includes(idx)
            const isActive = activeWizardDay === idx && isDelivery
            const done = isDelivery && dayComplete(lines, idx, enabledSlots)
            return (
              <button
                key={label}
                type="button"
                onClick={() => onDayCell(idx)}
                className={cn(
                  'relative flex aspect-square max-h-11 flex-col items-center justify-center rounded-full text-[11px] font-bold transition active:scale-[0.96]',
                  isActive
                    ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                    : isDelivery
                      ? done
                        ? 'border-2 border-[color:var(--text)] bg-[color:var(--surface)] text-[color:var(--text)]'
                        : 'border-2 border-[color:var(--text)]/40 bg-[color:var(--surface)]'
                      : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
                )}
              >
                {label}
                {done && !isActive ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[color:var(--text)] text-[8px] text-[color:var(--surface)]">
                    ✓
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[10px] text-[color:var(--muted)]">серые — не доставляем · тап — выбрать день меню</p>
      </section>

      {daysOk ? (
        <>
          {enabledSlots.length > 1 ? (
            <div className="mb-2">
              <SegmentedControl
                className="flex w-full max-w-none [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center"
                value={activeSlot}
                onChange={(v) => onActiveSlot(v as MealSlot)}
                options={enabledSlots.map((s) => ({
                  value: s,
                  label: MEAL_SLOT_LABEL[s],
                }))}
              />
            </div>
          ) : null}

          {hasTemplateForWeek ? (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={onCopyToAllWeek}
                className="shrink-0 rounded-full border border-[color:var(--text)] bg-[color:var(--text)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--surface)]"
              >
                на всю неделю
              </button>
              <button
                type="button"
                onClick={onClearDay}
                className="shrink-0 rounded-full border border-[color:var(--stroke)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--muted)]"
              >
                очистить {WEEKDAYS[activeWizardDay]}
              </button>
            </div>
          ) : null}

          {slotLines.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {slotLines.map((l) => {
                const dish = pickerDishes.find((d) => d.id === l.dishId)
                if (!dish) return null
                return (
                  <button
                    key={`${l.dayOfWeek}-${l.dishId}-${l.mealSlot}`}
                    type="button"
                    onClick={() => onRemoveLine(l)}
                    className="inline-flex max-w-[140px] items-center gap-1 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] py-0.5 pl-0.5 pr-2 text-[10px] font-semibold"
                  >
                    <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-black/[0.04]">
                      {dish.image ? <OptimizedImage src={dish.image} alt="" className="object-cover" sizes="20px" /> : null}
                    </span>
                    <span className="truncate">{dish.name}</span>
                    <span className="text-[color:var(--muted)]">×</span>
                  </button>
                )
              })}
              {slotQty < maxForSlot ? (
                <span className="self-center px-1 text-[10px] text-[color:var(--muted)]">+ ещё</span>
              ) : null}
            </div>
          ) : (
            <p className="mb-2 text-[12px] font-medium text-[color:var(--muted)]">
              {WEEKDAYS[activeWizardDay]} · {MEAL_SLOT_LABEL[activeSlot]} — выберите блюда
            </p>
          )}

          <ul className="space-y-2">
            {[...recommended, ...rest].map((d) => (
              <li key={d.id}>
                <CompactDishRow
                  dish={d}
                  highlight={recommendedDishIds.includes(d.id)}
                  selected={slotLines.some((l) => l.dishId === d.id)}
                  onAdd={() => onAddDish(d.id)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] px-3 py-3 text-[13px] text-[color:var(--muted)]">
          Выберите минимум {minDays} {minDays === 1 ? 'день' : 'дня'} доставки (тап по кружкам выше).
        </p>
      )}

      {allComplete && activeQuote && activeQuote.guestSavingsPercent > 0 ? (
        <p className="mt-4 text-center text-[12px] font-semibold text-[color:var(--muted)]">
          выгода <span className="font-extrabold text-[color:var(--text)]">−{Math.round(activeQuote.guestSavingsPercent)}%</span>
        </p>
      ) : null}

      <div
        className="fixed left-0 right-0 z-[110] px-3"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom) + 8px)' }}
      >
        <div className="ui-sticky-sheet flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold leading-tight">
              {!daysOk
                ? `ещё ${minDays - selectedDays.length} дн.`
                : allComplete
                  ? `${lines.length} блюд · готово`
                  : `${WEEKDAYS[activeWizardDay]} · ${MEAL_SLOT_LABEL[activeSlot]}`}
            </p>
            {daysOk && !allComplete && !activeDayComplete ? (
              <p className="text-[11px] font-medium text-[color:var(--muted)]">заполните этот день или «на всю неделю»</p>
            ) : null}
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
