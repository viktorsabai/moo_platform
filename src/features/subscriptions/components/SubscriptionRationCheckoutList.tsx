'use client'

import type { Dish } from '@/types'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import {
  WEEKDAYS,
  slotsForWizardDay,
  summarizeLineModifiers,
  wizardDayToJs,
  type SelectedLine,
} from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  lines: SelectedLine[]
  dishes: Dish[]
  selectedDays: number[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
}

/** Читаемый список рациона на чекауте: день → приёмы → блюда. */
export function SubscriptionRationCheckoutList({ lines, dishes, selectedDays, slotsByWizardDay, enabledSlots }: Props) {
  if (!selectedDays.length) return null

  return (
    <div className="space-y-3">
      {selectedDays.map((w) => {
        const js = wizardDayToJs(w)
        const daySlots = slotsForWizardDay(slotsByWizardDay, w, enabledSlots)
        const dayLines = lines.filter((l) => l.dayOfWeek === js)
        if (!daySlots.length && !dayLines.length) return null

        return (
          <div key={w} className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-2.5 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[14px] font-extrabold">{WEEKDAYS[w]}</p>
              <p className="text-[11px] font-semibold text-[color:var(--muted)]">
                {daySlots.map((s) => MEAL_SLOT_LABEL[s]).join(' · ') || 'без приёмов'}
              </p>
            </div>
            <div className="space-y-2">
              {daySlots.map((slot) => {
                const slotLines = dayLines.filter((l) => l.mealSlot === slot)
                if (!slotLines.length) {
                  return (
                    <p key={slot} className="text-[12px] text-[color:var(--muted)]">
                      {MEAL_SLOT_LABEL[slot]} — не выбрано
                    </p>
                  )
                }
                return (
                  <div key={slot}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                      {MEAL_SLOT_LABEL[slot]}
                    </p>
                    <ul className="space-y-1.5">
                      {slotLines.map((line) => {
                        const dish = dishes.find((d) => d.id === line.dishId)
                        const mods = dish ? summarizeLineModifiers(dish, line.modifierIds) : null
                        return (
                          <li
                            key={`${line.dishId}-${line.mealSlot}-${(line.modifierIds ?? []).join(',')}`}
                            className="flex items-center gap-2.5"
                          >
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
                              {dish?.image ? (
                                <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.checkoutThumb} />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[18px]">🍽</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-bold leading-tight">{dish?.name ?? 'блюдо'}</p>
                              {mods ? <p className="text-[11px] text-[color:var(--muted)]">{mods}</p> : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
