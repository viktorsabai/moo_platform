'use client'

import { useMemo, useState } from 'react'
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
  summarizeLineModifiers,
  WEEKDAYS,
  wizardDayToJs,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'
import { SubscriptionDayMealNest } from '@/features/subscriptions/components/SubscriptionDayMealNest'
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
  subConfig: SubscriptionConfig
  minDays: number
  maxDays: number
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  periodDays: number
  onDayCell: (wizardDay: number) => void
  onRemoveDayDelivery: (wizardDay: number) => void
  onToggleMealSlot: (slot: MealSlot) => void
  onActiveSlot: (s: MealSlot) => void
  onAddDish: (dishId: string) => void
  onEditLine: (line: SelectedLine) => void
  onRemoveLine: (line: SelectedLine) => void
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
  subConfig,
  minDays,
  maxDays,
  lines,
  periodDays,
  quotesByPeriod,
  onDayCell,
  onRemoveDayDelivery,
  onToggleMealSlot,
  onActiveSlot,
  onAddDish,
  onEditLine,
  onRemoveLine,
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

  function lineForDish(dishId: string) {
    return slotLines.find((l) => l.dishId === dishId)
  }

  return (
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+76px)]">
      <div className="mb-1 flex items-start gap-2">
        <a href="/subscriptions" className="ui-back-button mt-1 shrink-0" aria-label="назад">
          <IconChevronLeft className="h-5 w-5" />
        </a>
        <PageHeader title="рацион" subtitle="день → приёмы → блюда" compact className="min-w-0 flex-1" />
      </div>

      <SubscriptionFlowProgress step="build" onStep={(s) => s === 'pay' && allComplete && onOpenPay?.()} payEnabled={allComplete} />

      <SubscriptionDayMealNest
        selectedDays={selectedDays}
        activeWizardDay={activeWizardDay}
        slotsForActiveDay={slotsForActiveDay}
        activeSlot={activeSlot}
        enabledSlots={enabledSlots}
        minDays={minDays}
        maxDays={maxDays}
        mealSummary={
          slotLines.length > 0
            ? `${MEAL_SLOT_LABEL[activeSlot]}: ${
                slotLines.length === 1
                  ? '1 блюдо'
                  : slotLines.length < 5
                    ? `${slotLines.length} блюда`
                    : `${slotLines.length} блюд`
              }`
            : null
        }
        isDayFilled={(idx) => dayComplete(lines, idx, slotsForWizardDay(slotsByWizardDay, idx, enabledSlots))}
        prevWizardDay={prevWizardDay}
        onSelectDay={onDayCell}
        onRemoveDayDelivery={onRemoveDayDelivery}
        onToggleMeal={onToggleMealSlot}
        onSelectMeal={onActiveSlot}
        onCopyToAllWeek={onCopyToAllWeek}
        onCopyFromPrevDay={onCopyFromPrevDay}
        onClearDay={onClearDay}
      />

      {daysOk && slotsForActiveDay.includes(activeSlot) ? (
        <>
          <p className="mb-2 text-[13px] font-extrabold">
            {WEEKDAYS[activeWizardDay]} · {MEAL_SLOT_LABEL[activeSlot]}
          </p>

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
                      const hasOpts = dishHasConfigurableOptions(d, subConfig, activeSlot)
                      const summary = line ? summarizeLineModifiers(d, line.modifierIds) : null
                      return (
                        <SubscriptionDishCarouselCard
                          key={d.id}
                          dish={d}
                          selected={Boolean(line)}
                          hasOptions={hasOpts}
                          optionsSummary={summary}
                          needsOptions={Boolean(line && hasOpts && !summary)}
                          onAdd={() => onAddDish(d.id)}
                          onRemove={line ? () => onRemoveLine(line) : undefined}
                          onOpenOptions={
                            hasOpts ? () => (line ? onEditLine(line) : onAddDish(d.id)) : undefined
                          }
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
      ) : daysOk ? (
        <p className="text-[13px] text-[color:var(--muted)]">Включите приём пищи в карточке дня выше.</p>
      ) : (
        <p className="text-[13px] text-[color:var(--muted)]">Выберите минимум {minDays} дней доставки.</p>
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
