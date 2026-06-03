'use client'

import { Fragment, useMemo } from 'react'
import type { Dish } from '@/types'
import { cn } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import {
  WEEKDAYS,
  slotsForWizardDay,
  wizardDayToJs,
  type SelectedLine,
} from '@/features/subscriptions/lib/subscription-checkout-utils'

const SLOT_SHORT: Record<MealSlot, string> = {
  breakfast: 'з',
  lunch: 'о',
  dinner: 'у',
}

type Props = {
  lines: SelectedLine[]
  dishes: Dish[]
  selectedDays: number[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
}

/** Недельная сетка: столбец = день доставки, строка = приём пищи. */
export function SubscriptionRationWeekGrid({ lines, dishes, selectedDays, slotsByWizardDay, enabledSlots }: Props) {
  const mealRows = useMemo(() => {
    const set = new Set<MealSlot>()
    for (const w of selectedDays) {
      for (const s of slotsForWizardDay(slotsByWizardDay, w, enabledSlots)) set.add(s)
    }
    const order: MealSlot[] = ['breakfast', 'lunch', 'dinner']
    return order.filter((s) => set.has(s))
  }, [selectedDays, slotsByWizardDay, enabledSlots])

  if (!selectedDays.length || !mealRows.length) return null

  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="grid min-w-[280px] gap-1.5"
        style={{ gridTemplateColumns: `28px repeat(${selectedDays.length}, minmax(56px, 1fr))` }}
      >
        <div />
        {selectedDays.map((w) => {
          const js = wizardDayToJs(w)
          const count = lines.filter((l) => l.dayOfWeek === js).length
          return (
            <div key={w} className="rounded-t-lg bg-[color:var(--text)] px-1 py-1.5 text-center text-[color:var(--surface)]">
              <p className="text-[12px] font-extrabold leading-none">{WEEKDAYS[w]}</p>
              <p className="mt-0.5 text-[9px] opacity-80">{count} блюд</p>
            </div>
          )
        })}

        {mealRows.map((slot) => (
          <Fragment key={slot}>
            <p
              className="flex items-center justify-center text-[12px] font-extrabold text-[color:var(--muted)]"
              title={MEAL_SLOT_LABEL[slot]}
            >
              {SLOT_SHORT[slot]}
            </p>
            {selectedDays.map((w) => {
              const js = wizardDayToJs(w)
              const daySlots = slotsForWizardDay(slotsByWizardDay, w, enabledSlots)
              if (!daySlots.includes(slot)) {
                return (
                  <div
                    key={`${w}-${slot}`}
                    className="flex min-h-[56px] items-center justify-center rounded-lg bg-black/[0.03] text-[11px] text-[color:var(--muted)]"
                  >
                    —
                  </div>
                )
              }
              const cellLines = lines.filter((l) => l.dayOfWeek === js && l.mealSlot === slot)
              return (
                <div
                  key={`${w}-${slot}`}
                  className={cn(
                    'flex min-h-[56px] flex-col justify-center gap-1 rounded-lg border px-1 py-1.5',
                    cellLines.length
                      ? 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)]'
                      : 'border-dashed border-[color:var(--stroke)] bg-[color:var(--surface)]'
                  )}
                >
                  {cellLines.length ? (
                    cellLines.slice(0, 2).map((l) => {
                      const dish = dishes.find((d) => d.id === l.dishId)
                      return (
                        <div key={`${l.dishId}-${(l.modifierIds ?? []).join(',')}`} className="flex items-center gap-1">
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-black/[0.04]">
                            {dish?.image ? (
                              <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.checkoutThumb} />
                            ) : (
                              <span className="flex h-full items-center justify-center text-[12px]">🍽</span>
                            )}
                          </div>
                          <span className="line-clamp-2 min-w-0 flex-1 text-[9px] font-semibold leading-tight">
                            {dish?.name ?? '—'}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <span className="text-center text-[10px] text-[color:var(--muted)]">пусто</span>
                  )}
                  {cellLines.length > 2 ? (
                    <span className="text-center text-[9px] font-bold text-[color:var(--muted)]">+{cellLines.length - 2}</span>
                  ) : null}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[color:var(--muted)]">з · завтрак · о · обед · у · ужин</p>
    </div>
  )
}
