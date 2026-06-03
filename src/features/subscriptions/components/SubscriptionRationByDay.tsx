'use client'

import type { Dish } from '@/types'
import type { MealSlot } from '@/lib/subscription-meal-slots'
import { SubscriptionRationCheckoutList } from '@/features/subscriptions/components/SubscriptionRationCheckoutList'
import type { SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  lines: SelectedLine[]
  dishes: Dish[]
  selectedDays: number[]
  slotsByWizardDay: Record<number, MealSlot[]>
  enabledSlots: MealSlot[]
  summaryLine?: string | null
  onEditRation: () => void
}

/** Превью рациона на оплате — недельная сетка вместо списка «Вт · 3 блюда». */
export function SubscriptionRationByDay({
  lines,
  dishes,
  selectedDays,
  slotsByWizardDay,
  enabledSlots,
  summaryLine,
  onEditRation,
}: Props) {
  if (!selectedDays.length) return null

  return (
    <section className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold">ваш рацион</p>
          {summaryLine ? <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">{summaryLine}</p> : null}
        </div>
        <button type="button" onClick={onEditRation} className="shrink-0 rounded-full border border-[color:var(--stroke)] px-3 py-1.5 text-[12px] font-bold">
          изменить
        </button>
      </div>

      <SubscriptionRationCheckoutList
        lines={lines}
        dishes={dishes}
        selectedDays={selectedDays}
        slotsByWizardDay={slotsByWizardDay}
        enabledSlots={enabledSlots}
      />
    </section>
  )
}
