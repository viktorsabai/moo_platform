'use client'

import type { Dish } from '@/types'
import { SubscriptionDishOptionsPanel } from '@/features/subscriptions/components/SubscriptionDishOptionsPanel'
import { resolveAllowedOptionIdsForDish } from '@/features/subscriptions/lib/subscription-checkout-utils'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import type { SelectedLine } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { MEAL_SLOT_LABEL } from '@/lib/subscription-meal-slots'
import { WEEKDAYS, jsDayToWizard } from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  line: SelectedLine
  dish: Dish
  subConfig: SubscriptionConfig
  onChange: (modifierIds: string[]) => void
  onClose: () => void
}

export function SubscriptionDishOptionsSheet({ line, dish, subConfig, onChange, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[130] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85vh] min-h-[40vh] overflow-y-auto rounded-t-[var(--radius-large)] border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 pb-[calc(env(safe-area-inset-bottom)+80px)] pt-4 shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold leading-tight">{dish.name}</p>
            <p className="text-[12px] text-[color:var(--muted)]">
              {WEEKDAYS[jsDayToWizard(line.dayOfWeek)]} · {line.mealSlot ? MEAL_SLOT_LABEL[line.mealSlot] : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold">
            готово
          </button>
        </div>
        <SubscriptionDishOptionsPanel
          dish={dish}
          modifierIds={line.modifierIds ?? []}
          allowedOptionIds={resolveAllowedOptionIdsForDish(subConfig, line.mealSlot, dish)}
          onChange={onChange}
          compact={false}
          defaultCollapsed={false}
          emptyHint="У этого блюда нет опций в меню — можно нажать «готово»."
        />
      </div>
    </div>
  )
}
