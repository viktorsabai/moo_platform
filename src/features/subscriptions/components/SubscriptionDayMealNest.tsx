'use client'

import { useRef } from 'react'
import type { MealSlot } from '@/lib/subscription-meal-slots'
import { MEAL_SLOT_LABEL } from '@/lib/subscription-meal-slots'
import { cn } from '@/lib/utils'
import { WEEKDAYS } from '@/features/subscriptions/lib/subscription-checkout-utils'

const LONG_PRESS_MS = 520

type Props = {
  selectedDays: number[]
  activeWizardDay: number
  slotsForActiveDay: MealSlot[]
  activeSlot: MealSlot
  enabledSlots: MealSlot[]
  minDays: number
  maxDays: number
  mealSummary?: string | null
  onSelectDay: (wizardDay: number) => void
  onRemoveDayDelivery: (wizardDay: number) => void
  onToggleMeal: (slot: MealSlot) => void
  onSelectMeal: (slot: MealSlot) => void
  onCopyToAllWeek?: () => void
  onCopyFromPrevDay?: () => void
  onClearDay?: () => void
  prevWizardDay: number | null
  isDayFilled?: (wizardDay: number) => boolean
}

/** День → приёмы: одна «матрёшка» без лишних рядов. */
export function SubscriptionDayMealNest({
  selectedDays,
  activeWizardDay,
  slotsForActiveDay,
  activeSlot,
  enabledSlots,
  minDays,
  maxDays,
  mealSummary,
  onSelectDay,
  onRemoveDayDelivery,
  onToggleMeal,
  onSelectMeal,
  onCopyToAllWeek,
  onCopyFromPrevDay,
  onClearDay,
  prevWizardDay,
  isDayFilled,
}: Props) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  const daysOk = selectedDays.length >= minDays
  const isDeliveryDay = selectedDays.includes(activeWizardDay)
  const canRemoveDay = selectedDays.length > minDays

  function clearPressTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function startLongPress(day: number) {
    longPressFired.current = false
    clearPressTimer()
    if (!selectedDays.includes(day) || !canRemoveDay) return
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true
      onRemoveDayDelivery(day)
    }, LONG_PRESS_MS)
  }

  function handleDayTap(day: number) {
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    onSelectDay(day)
  }

  function handleMealTap(slot: MealSlot) {
    const on = slotsForActiveDay.includes(slot)
    if (!on) {
      onToggleMeal(slot)
      onSelectMeal(slot)
      return
    }
    if (activeSlot !== slot) {
      onSelectMeal(slot)
      return
    }
    onToggleMeal(slot)
  }

  const enabledMealLabel = slotsForActiveDay.map((s) => MEAL_SLOT_LABEL[s].toLowerCase()).join(' · ')

  return (
    <section className="mb-3 space-y-2">
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
          дни доставки · {selectedDays.length}/{minDays}–{maxDays}
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((label, idx) => {
            const isDelivery = selectedDays.includes(idx)
            const isActive = activeWizardDay === idx
            const done = isDelivery && (isDayFilled?.(idx) ?? false)
            return (
              <button
                key={label}
                type="button"
                onClick={() => handleDayTap(idx)}
                onPointerDown={() => startLongPress(idx)}
                onPointerUp={clearPressTimer}
                onPointerLeave={clearPressTimer}
                onPointerCancel={clearPressTimer}
                className={cn(
                  'flex aspect-square max-h-11 flex-col items-center justify-center rounded-full text-[11px] font-bold transition active:scale-[0.96]',
                  isActive && isDelivery
                    ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                    : isDelivery
                      ? done
                        ? 'border-2 border-[color:var(--text)] bg-[color:var(--surface)]'
                        : 'border-2 border-[color:var(--text)]/50 bg-[color:var(--surface)]'
                      : 'border border-dashed border-[color:var(--stroke)] text-[color:var(--muted)]'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-[10px] text-[color:var(--muted)]">
          тап — день · удержите включённый день — убрать доставку
        </p>
      </div>

      {daysOk && isDeliveryDay ? (
        <div className="rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3 shadow-[var(--shadow-soft)]">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold leading-tight">{WEEKDAYS[activeWizardDay]}</p>
              <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">
                {slotsForActiveDay.length
                  ? `${slotsForActiveDay.length} приём${slotsForActiveDay.length === 1 ? '' : slotsForActiveDay.length < 5 ? 'а' : 'ов'}: ${enabledMealLabel}`
                  : 'включите приёмы ниже'}
              </p>
            </div>
            {canRemoveDay ? (
              <button
                type="button"
                onClick={() => onRemoveDayDelivery(activeWizardDay)}
                className="shrink-0 text-[11px] font-bold text-red-600"
              >
                без доставки
              </button>
            ) : null}
          </div>

          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">приёмы в этот день</p>
          <div className="flex gap-1.5">
            {enabledSlots.map((slot) => {
              const on = slotsForActiveDay.includes(slot)
              const active = activeSlot === slot && on
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleMealTap(slot)}
                  className={cn(
                    'min-w-0 flex-1 rounded-full py-2.5 text-[12px] font-bold transition',
                    on
                      ? active
                        ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                        : 'border-2 border-[color:var(--text)] bg-[color:var(--surface-strong)] text-[color:var(--text)]'
                      : 'border border-dashed border-[color:var(--stroke)] text-[color:var(--muted)]'
                  )}
                >
                  {on ? MEAL_SLOT_LABEL[slot] : `${MEAL_SLOT_LABEL[slot]} · выкл`}
                </button>
              )
            })}
          </div>

          {mealSummary ? (
            <p className="mt-2 text-[11px] font-semibold text-[color:var(--muted)]">{mealSummary}</p>
          ) : null}

          <div className="mt-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {onCopyToAllWeek ? (
              <button
                type="button"
                onClick={onCopyToAllWeek}
                className="shrink-0 rounded-full border border-[color:var(--stroke)] px-2.5 py-1.5 text-[10px] font-semibold"
              >
                неделя как {WEEKDAYS[activeWizardDay]}
              </button>
            ) : null}
            {prevWizardDay != null && onCopyFromPrevDay ? (
              <button
                type="button"
                onClick={onCopyFromPrevDay}
                className="shrink-0 rounded-full border border-[color:var(--stroke)] px-2.5 py-1.5 text-[10px] font-semibold"
              >
                как {WEEKDAYS[prevWizardDay]}
              </button>
            ) : null}
            {onClearDay ? (
              <button
                type="button"
                onClick={onClearDay}
                className="shrink-0 rounded-full border border-[color:var(--stroke)] px-2.5 py-1.5 text-[10px] font-semibold text-[color:var(--muted)]"
              >
                очистить блюда
              </button>
            ) : null}
          </div>
        </div>
      ) : daysOk ? (
        <p className="text-[13px] text-[color:var(--muted)]">Выберите день доставки в кружках выше.</p>
      ) : null}
    </section>
  )
}
