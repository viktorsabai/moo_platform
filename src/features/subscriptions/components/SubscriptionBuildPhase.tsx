'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconChevronLeft, IconChevronUp } from '@/components/ui/icons'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import type { MenuCategory, PeriodQuote, SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import {
  dishHasConfigurableOptions,
  groupDishesForPicker,
  nextMissingMealHint,
  slotsForWizardDay,
  TAG_FILTERS,
  WEEKDAYS,
  wizardDayToJs,
} from '@/features/subscriptions/lib/subscription-checkout-utils'
import { SubscriptionFlowProgress } from '@/features/subscriptions/components/SubscriptionFlowProgress'

type Props = {
  selectedDays: number[]
  activeWizardDay: number
  activeSlot: MealSlot
  slotsForActiveDay: MealSlot[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
  pickerDishes: Dish[]
  allDishes: Dish[]
  lines: SelectedLine[]
  recommendedDishIds: string[]
  menuCategories: MenuCategory[]
  categoryFilter: string
  subConfig: SubscriptionConfig
  minDays: number
  maxDays: number
  quotesByPeriod: Record<number, PeriodQuote | undefined>
  periodDays: number
  onDayCell: (wizardDay: number) => void
  onToggleMealSlot: (slot: MealSlot) => void
  onCategoryFilter: (id: string) => void
  onActiveSlot: (s: MealSlot) => void
  onAddDish: (dishId: string) => void
  onRemoveLine: (line: SelectedLine) => void
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

function CompactDishRow({
  dish,
  selected,
  highlight,
  hasOptions,
  onAdd,
}: {
  dish: Dish
  selected: boolean
  highlight?: boolean
  hasOptions?: boolean
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
        <p className="text-[12px] font-bold tabular-nums text-[color:var(--muted)]">
          {formatPrice(dish.price)}
          {hasOptions ? ' · настроить' : ''}
        </p>
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
  slotsForActiveDay,
  slotsByWizardDay,
  enabledSlots,
  pickerDishes,
  menuCategories,
  categoryFilter,
  minDays,
  maxDays,
  lines,
  recommendedDishIds,
  onDayCell,
  onToggleMealSlot,
  onCategoryFilter,
  onActiveSlot,
  onAddDish,
  onEditLine,
  onCopyToAllWeek,
  onClearDay,
  onContinue,
  onOpenPay,
}: Props) {
  const daysOk = selectedDays.length >= minDays
  const [editingDays, setEditingDays] = useState(!daysOk)

  useEffect(() => {
    if (!daysOk) setEditingDays(true)
  }, [daysOk])

  const jsDay = wizardDayToJs(activeWizardDay)
  const allComplete =
    daysOk &&
    selectedDays.every((d) => dayComplete(lines, d, slotsForWizardDay(slotsByWizardDay, d, enabledSlots)))
  const missingHint = daysOk && !allComplete ? nextMissingMealHint(lines, selectedDays, slotsByWizardDay, enabledSlots) : null
  const slotLines = lines.filter((l) => l.dayOfWeek === jsDay && l.mealSlot === activeSlot)

  const pickerCategories = useMemo(
    () => menuCategories.filter((c) => pickerDishes.some((d) => (d.categoryId || 'uncat') === c.id)),
    [menuCategories, pickerDishes]
  )

  const dishSections = useMemo(
    () => groupDishesForPicker(pickerDishes, pickerCategories.length ? pickerCategories : menuCategories, categoryFilter),
    [pickerDishes, pickerCategories, menuCategories, categoryFilter]
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
    <main className="ui-container ui-screen pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+92px)]">
      <div className="mb-1 flex items-start gap-2">
        <a href="/subscriptions" className="ui-back-button mt-1 shrink-0" aria-label="назад">
          <IconChevronLeft className="h-5 w-5" />
        </a>
        <PageHeader title="рацион" subtitle="день → приём → блюдо" compact className="min-w-0 flex-1" />
      </div>

      <SubscriptionFlowProgress step="build" onStep={(s) => s === 'pay' && allComplete && onOpenPay?.()} payEnabled={allComplete} />

      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
            дни · {selectedDays.length}/{minDays}–{maxDays}
          </p>
          {daysOk ? (
            <button
              type="button"
              onClick={() => setEditingDays((v) => !v)}
              className="text-[11px] font-bold text-[color:var(--muted)] underline-offset-2 hover:underline"
            >
              {editingDays ? 'готово' : 'изменить дни'}
            </button>
          ) : null}
        </div>

        {editingDays || !daysOk ? (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((label, idx) => {
              const isDelivery = selectedDays.includes(idx)
              const isActive = activeWizardDay === idx && isDelivery
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onDayCell(idx)
                    if (selectedDays.includes(idx) || selectedDays.length + 1 >= minDays) {
                      setEditingDays(false)
                    }
                  }}
                  className={cn(
                    'flex aspect-square max-h-11 items-center justify-center rounded-full text-[11px] font-bold transition active:scale-[0.96]',
                    isActive
                      ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                      : isDelivery
                        ? 'border-2 border-[color:var(--text)]'
                        : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {selectedDays.map((idx) => {
              const isActive = activeWizardDay === idx
              const done = dayComplete(lines, idx, slotsForWizardDay(slotsByWizardDay, idx, enabledSlots))
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onDayCell(idx)}
                  className={cn(
                    'shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold',
                    isActive
                      ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                      : done
                        ? 'border border-[color:var(--text)]'
                        : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
                  )}
                >
                  {WEEKDAYS[idx]}
                  {done ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        )}
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
                          ? 'border-2 border-[color:var(--text)]/50'
                          : 'border border-dashed border-[color:var(--stroke)] text-[color:var(--muted)] opacity-55'
                    )}
                  >
                    {MEAL_SLOT_LABEL[s]}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-[10px] text-[color:var(--muted)]">тап — выбрать приём · повторный — выключить</p>
          </div>

          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => onCategoryFilter('all')}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold',
                categoryFilter === 'all' ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
              )}
            >
              всё
            </button>
            {pickerCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryFilter(c.id)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold',
                  categoryFilter === c.id ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
                )}
              >
                {c.emoji ? `${c.emoji} ` : ''}
                {c.name}
              </button>
            ))}
            {TAG_FILTERS.filter((t) => t.id !== 'all').map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onCategoryFilter(`tag:${t.id}`)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold',
                  categoryFilter === `tag:${t.id}` ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={onCopyToAllWeek}
              className="text-[11px] font-semibold text-[color:var(--muted)] underline-offset-2 hover:underline"
            >
              на всю неделю
            </button>
            <span className="text-[color:var(--stroke)]">·</span>
            <button
              type="button"
              onClick={onClearDay}
              className="text-[11px] font-semibold text-[color:var(--muted)] underline-offset-2 hover:underline"
            >
              очистить {WEEKDAYS[activeWizardDay]}
            </button>
          </div>

          {dishSections.length > 0 ? (
            <div className="space-y-4">
              {dishSections.map(({ category, dishes }) => (
                <section key={category.id}>
                  <h3 className="mb-1.5 px-0.5 text-[12px] font-extrabold text-[color:var(--muted)]">
                    {category.emoji ? `${category.emoji} ` : ''}
                    {category.name}
                  </h3>
                  <ul className="space-y-2">
                    {dishes.map((d) => {
                      const line = slotLines.find((l) => l.dishId === d.id)
                      return (
                        <li key={d.id}>
                          <CompactDishRow
                            dish={d}
                            highlight={recommendedDishIds.includes(d.id)}
                            selected={Boolean(line)}
                            hasOptions={dishHasConfigurableOptions(d)}
                            onAdd={() => (line ? onEditLine(line) : onAddDish(d.id))}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[color:var(--muted)]">Нет блюд для этого приёма</p>
          )}
        </>
      ) : (
        <p className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] px-3 py-3 text-[13px] text-[color:var(--muted)]">
          Выберите {minDays}–{maxDays} дней доставки в сетке выше.
        </p>
      )}

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
                  ? `${lines.length} блюд · можно к оплате`
                  : missingHint ?? `${WEEKDAYS[activeWizardDay]} · ${MEAL_SLOT_LABEL[activeSlot]}`}
            </p>
            {daysOk && !allComplete ? (
              <p className="text-[11px] text-[color:var(--muted)]">только включённые приёмы</p>
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
