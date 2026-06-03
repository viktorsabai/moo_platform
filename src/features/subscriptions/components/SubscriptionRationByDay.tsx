'use client'

import { useMemo } from 'react'
import type { Dish } from '@/types'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import { SubscriptionRationStrip } from '@/features/subscriptions/components/SubscriptionRationStrip'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import {
  WEEKDAYS,
  groupDayLinesByMealSlot,
  lineKey,
  slotsForWizardDay,
  wizardDayToJs,
  type SelectedLine,
} from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  lines: SelectedLine[]
  dishes: Dish[]
  selectedDays: number[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
  subConfig: SubscriptionConfig
  summaryLine?: string | null
  onEditRation: () => void
}

/** Компактное превью рациона на шаге оплаты — без второго переключателя дней. */
export function SubscriptionRationByDay({
  lines,
  dishes,
  selectedDays,
  slotsByWizardDay,
  enabledSlots,
  summaryLine,
  onEditRation,
}: Props) {
  const stripLines = useMemo(
    () =>
      lines.slice(0, 14).map((l) => {
        const dish = dishes.find((d) => d.id === l.dishId)
        return {
          key: lineKey(l),
          dishId: l.dishId,
          quantity: l.quantity,
          image: dish?.image,
          name: dish?.name ?? '',
        }
      }),
    [lines, dishes]
  )

  const daySummaries = useMemo(() => {
    return selectedDays.map((w) => {
      const js = wizardDayToJs(w)
      const slots = slotsForWizardDay(slotsByWizardDay, w, enabledSlots)
      const groups = groupDayLinesByMealSlot(lines, js, slots)
      const count = lines.filter((l) => l.dayOfWeek === js).length
      return { w, count, groups }
    })
  }, [selectedDays, lines, slotsByWizardDay, enabledSlots])

  if (!selectedDays.length) return null

  return (
    <section className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold">ваш рацион</p>
          {summaryLine ? <p className="text-[11px] text-[color:var(--muted)]">{summaryLine}</p> : null}
        </div>
        <button type="button" onClick={onEditRation} className="shrink-0 text-[12px] font-bold underline-offset-2 hover:underline">
          изменить
        </button>
      </div>

      <SubscriptionRationStrip lines={stripLines} dense className="mx-0 mb-3" />

      <ul className="space-y-2.5">
        {daySummaries.map(({ w, count, groups }) => (
          <li key={w} className="rounded-[var(--radius-medium)] bg-black/[0.02] px-2.5 py-2">
            <p className="text-[12px] font-bold">
              {WEEKDAYS[w]} · {count} {count === 1 ? 'блюдо' : count < 5 ? 'блюда' : 'блюд'}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--muted)]">
              {groups
                .map(({ slot, items }) => `${slot ? MEAL_SLOT_LABEL[slot] : 'меню'}: ${items.length}`)
                .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
