'use client'

import { useMemo, useState } from 'react'
import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconChevronLeft, IconChevronUp } from '@/components/ui/icons'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { MenuCategory, PeriodQuote, SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import {
  dishHasConfigurableOptions,
  groupDishesForPicker,
  nextMissingMealHint,
  slotsForWizardDay,
  summarizeLineModifiers,
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
  menuCategories: MenuCategory[]
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
  onCopyFromPrevDay: () => void
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
  onCopyFromPrevDay,
  onClearDay,
  onContinue,
  onOpenPay,
}: Props) {
  const daysOk = selectedDays.length >= minDays
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const jsDay = wizardDayToJs(activeWizardDay)
  const allComplete =
    daysOk &&
    selectedDays.every((d) => dayComplete(lines, d, slotsForWizardDay(slotsByWizardDay, d, enabledSlots)))
  const missingHint = daysOk && !allComplete ? nextMissingMealHint(lines, selectedDays, slotsByWizardDay, enabledSlots) : null
  const slotLines = lines.filter((l) => l.dayOfWeek === jsDay && l.mealSlot === activeSlot)
  const periodQuote = quotesByPeriod[periodDays]

  const prevWizardDay = useMemo(() => {
    const idx = selectedDays.indexOf(activeWizardDay)
    return idx > 0 ? selectedDays[idx - 1] : null
  }, [selectedDays, activeWizardDay])

  const pickerCategories = useMemo(
    () => menuCategories.filter((c) => pickerDishes.some((d) => (d.categoryId || 'uncat') === c.id)),
    [menuCategories, pickerDishes]
  )

  const dishSections = useMemo(
    () => groupDishesForPicker(pickerDishes, pickerCategories.length ? pickerCategories : menuCategories, 'all'),
    [pickerDishes, pickerCategories, menuCategories]
  )

  const visibleSections = useMemo(
    () => (activeCategory === 'all' ? dishSections : dishSections.filter((s) => s.category.id === activeCategory)),
    [dishSections, activeCategory]
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

  function lineForDish(dishId: string) {
    return slotLines.find((l) => l.dishId === dishId)
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
          <div className="mb-2">
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
                          ? 'border-2 border-[color:var(--text)]/45'
                          : 'border border-[color:var(--stroke)] text-[color:var(--muted)] opacity-50'
                    )}
                  >
                    {MEAL_SLOT_LABEL[s]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={onCopyToAllWeek}
              className="shrink-0 rounded-full border border-[color:var(--text)] bg-[color:var(--text)] px-3 py-2 text-[11px] font-bold text-[color:var(--surface)]"
            >
              на всю неделю
            </button>
            {prevWizardDay != null ? (
              <button
                type="button"
                onClick={onCopyFromPrevDay}
                className="shrink-0 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[11px] font-bold"
              >
                как {WEEKDAYS[prevWizardDay]}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClearDay}
              className="shrink-0 rounded-full border border-[color:var(--stroke)] px-3 py-2 text-[11px] font-semibold text-[color:var(--muted)]"
            >
              очистить день
            </button>
          </div>

          {pickerCategories.length > 0 ? (
            <div className="sticky top-0 z-[5] -mx-1 mb-2 flex gap-1.5 overflow-x-auto bg-[color:var(--bg)]/95 py-1 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold',
                  activeCategory === 'all' ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
                )}
              >
                всё
              </button>
              {pickerCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold',
                    activeCategory === c.id ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
                  )}
                >
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}

          {visibleSections.length > 0 ? (
            <div className="space-y-5 pb-2">
              {visibleSections.map(({ category, dishes }) => (
                <section key={category.id}>
                  {activeCategory === 'all' ? (
                    <h3 className="mb-2 px-0.5 text-[13px] font-extrabold">
                      {category.emoji ? `${category.emoji} ` : ''}
                      {category.name}
                    </h3>
                  ) : null}
                  <div
                    className="-mx-1 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {dishes.map((d) => {
                      const line = lineForDish(d.id)
                      const hasOpts = dishHasConfigurableOptions(d)
                      const summary = line ? summarizeLineModifiers(d, line.modifierIds) : null
                      return (
                        <SubscriptionDishCarouselCard
                          key={d.id}
                          dish={d}
                          selected={Boolean(line)}
                          hasOptions={hasOpts}
                          optionsSummary={summary}
                          needsOptions={Boolean(line && hasOpts && !summary)}
                          onPress={() => (line ? onEditLine(line) : onAddDish(d.id))}
                          onOptionsPress={hasOpts ? () => (line ? onEditLine(line) : onAddDish(d.id)) : undefined}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[color:var(--muted)]">Нет блюд в этой категории</p>
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
