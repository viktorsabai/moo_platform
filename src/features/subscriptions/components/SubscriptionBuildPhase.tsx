'use client'

import { useMemo } from 'react'
import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconChevronLeft, IconChevronUp } from '@/components/ui/icons'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import type { MenuCategory, PeriodQuote, SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import {
  dishHasConfigurableOptions,
  groupDishesForPicker,
  nextMissingMealHint,
  slotsForWizardDay,
  WEEKDAYS,
  wizardDayToJs,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'
import { SubscriptionDishCarouselCard } from '@/features/subscriptions/components/SubscriptionDishCarouselCard'

type Props = {
  selectedDays: number[]
  activeWizardDay: number
  activeSlot: MealSlot
  slotsForActiveDay: MealSlot[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
  pickerDishes: Dish[]
  lines: SelectedLine[]
  recommendedDishIds: string[]
  menuCategories: MenuCategory[]
  subConfig: SubscriptionConfig
  minDays: number
  maxDays: number
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  periodDays: number
  onDayCell: (wizardDay: number) => void
  onToggleMealSlot: (slot: MealSlot) => void
  onActiveSlot: (s: MealSlot) => void
  onAddDish: (dishId: string) => void
  onEditLine: (line: SelectedLine) => void
  onCopyToAllWeek: () => void
  onClearDay: () => void
  onContinue: () => void
  onOpenPay?: () => void
}

function dayComplete(lines: SelectedLine[], wizardDay: number, slots: MealSlot[]) {
  const js = wizardDayToJs(wizardDay)
  if (!slots.length) return false
  return slots.every((slot) => lines.some((l) => l.dayOfWeek === js && l.mealSlot === slot))
}

export function SubscriptionBuildPhase({
  selectedDays,
  activeWizardDay,
  activeSlot,
  slotsForActiveDay,
  slotsByWizardDay,
  enabledSlots,
  pickerDishes,
  menuCategories,
  minDays,
  maxDays,
  lines,
  periodDays,
  quotesByPeriod,
  onDayCell,
  onToggleMealSlot,
  onActiveSlot,
  onAddDish,
  onEditLine,
  onCopyToAllWeek,
  onClearDay,
  onContinue,
  onOpenPay,
}: Props) {
  const daysOk = selectedDays.length >= minDays
  const jsDay = wizardDayToJs(activeWizardDay)
  const allComplete =
    daysOk &&
    selectedDays.every((d) => dayComplete(lines, d, slotsForWizardDay(slotsByWizardDay, d, enabledSlots)))
  const missingHint = daysOk && !allComplete ? nextMissingMealHint(lines, selectedDays, slotsByWizardDay, enabledSlots) : null
  const slotLines = lines.filter((l) => l.dayOfWeek === jsDay && l.mealSlot === activeSlot)
  const periodQuote = quotesByPeriod[periodDays]

  const pickerCategories = useMemo(
    () => menuCategories.filter((c) => pickerDishes.some((d) => (d.categoryId || 'uncat') === c.id)),
    [menuCategories, pickerDishes]
  )

  const dishSections = useMemo(
    () => groupDishesForPicker(pickerDishes, pickerCategories.length ? pickerCategories : menuCategories, 'all'),
    [pickerDishes, pickerCategories, menuCategories]
  )

  function handleMealPress(slot: MealSlot) {
    const on = slotsForActiveDay.includes(slot)
    if (!on) {
      onToggleMealSlot(slot)
      onActiveSlot(slot)
      return
    }
    if (activeSlot !== slot) {
      onActiveSlot(slot)
      return
    }
    onToggleMealSlot(slot)
  }

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+76px)]">
      <div className="mb-1 flex items-start gap-2">
        <a href="/subscriptions" className="ui-back-button mt-1 shrink-0" aria-label="назад">
          <IconChevronLeft className="h-5 w-5" />
        </a>
        <PageHeader title="рацион" subtitle="день → приём → блюдо" compact className="min-w-0 flex-1" />
      </div>

      <SubscriptionFlowProgress step="build" onStep={(s) => s === 'pay' && allComplete && onOpenPay?.()} payEnabled={allComplete} />

      <section className="mb-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
          дни · {selectedDays.length}/{minDays}–{maxDays}
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label, idx) => {
            const isDelivery = selectedDays.includes(idx)
            const isActive = activeWizardDay === idx && isDelivery
            const done = isDelivery && dayComplete(lines, idx, slotsForWizardDay(slotsByWizardDay, idx, enabledSlots))
            return (
              <button
                key={label}
                type="button"
                onClick={() => onDayCell(idx)}
                className={cn(
                  'flex aspect-square max-h-11 items-center justify-center rounded-full text-[11px] font-bold transition active:scale-[0.96]',
                  isActive
                    ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                    : isDelivery
                      ? done
                        ? 'border-2 border-[color:var(--text)] bg-[color:var(--surface)]'
                        : 'border-2 border-[color:var(--text)]/40'
                      : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {daysOk ? (
        <>
          <div className="mb-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              {WEEKDAYS[activeWizardDay]} · приёмы
            </p>
            <div className="flex gap-1.5">
              {enabledSlots.map((s) => {
                const enabled = slotsForActiveDay.includes(s)
                const active = activeSlot === s && enabled
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleMealPress(s)}
                    className={cn(
                      'min-w-0 flex-1 rounded-full py-2 text-[12px] font-bold capitalize transition',
                      active
                        ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                        : enabled
                          ? 'border-2 border-[color:var(--text)]/45 bg-[color:var(--surface)]'
                          : 'border border-[color:var(--stroke)] text-[color:var(--muted)] opacity-50'
                    )}
                  >
                    {MEAL_SLOT_LABEL[s]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-3 flex gap-3 text-[11px] font-semibold text-[color:var(--muted)]">
            <button type="button" onClick={onCopyToAllWeek} className="underline-offset-2 hover:underline">
              на всю неделю
            </button>
            <button type="button" onClick={onClearDay} className="underline-offset-2 hover:underline">
              очистить день
            </button>
          </div>

          {dishSections.length > 0 ? (
            <div className="space-y-4 pb-2">
              {dishSections.map(({ category, dishes }) => (
                <section key={category.id}>
                  <h3 className="mb-2 px-0.5 text-[13px] font-extrabold">
                    {category.emoji ? `${category.emoji} ` : ''}
                    {category.name}
                  </h3>
                  <div
                    className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {dishes.map((d) => {
                      const line = slotLines.find((l) => l.dishId === d.id)
                      return (
                        <SubscriptionDishCarouselCard
                          key={d.id}
                          dish={d}
                          selected={Boolean(line)}
                          hasOptions={dishHasConfigurableOptions(d)}
                          onPress={() => (line ? onEditLine(line) : onAddDish(d.id))}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[color:var(--muted)]">Нет блюд для этого приёма</p>
          )}
        </>
      ) : (
        <p className="text-[13px] text-[color:var(--muted)]">Выберите минимум {minDays} дней в кружках выше.</p>
      )}

      <div
        className="fixed inset-x-0 z-[110] border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/98 backdrop-blur-md"
        style={{ bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            {!daysOk ? (
              <p className="text-[13px] font-bold">ещё {minDays - selectedDays.length} дн. доставки</p>
            ) : allComplete ? (
              <>
                <p className="text-[14px] font-extrabold leading-tight">{lines.length} блюд · готово</p>
                {periodQuote ? (
                  <p className="text-[11px] tabular-nums text-[color:var(--muted)]">от {formatPrice(periodQuote.guestPrice)}</p>
                ) : null}
              </>
            ) : (
              <p className="text-[13px] font-bold leading-tight">добавьте: {missingHint}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!allComplete}
            className="btn btn-primary h-10 shrink-0 rounded-full px-4 text-[13px] font-bold disabled:opacity-40"
          >
            далее
            <IconChevronUp className="ml-0.5 inline h-4 w-4 rotate-90" />
          </button>
        </div>
      </div>
    </main>
  )
}
