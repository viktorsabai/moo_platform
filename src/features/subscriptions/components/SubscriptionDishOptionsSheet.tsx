'use client'

import type { Dish } from '@/types'
import { SubscriptionDishOptionsPanel } from '@/features/subscriptions/components/SubscriptionDishOptionsPanel'
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
  onRemove: () => void
}

export function SubscriptionDishOptionsSheet({ line, dish, subConfig: _subConfig, onChange, onClose, onRemove }: Props) {
  const groupCount = (dish.optionGroups ?? []).reduce((n, g) => n + (g.values?.length ?? 0), 0)
  const modCount = (dish.modifiers ?? []).length

  return (
    <div className="fixed inset-0 z-[140] flex flex-col justify-end bg-black/55" onClick={onClose}>
      <div
        className="flex max-h-[88vh] min-h-[50vh] flex-col rounded-t-2xl bg-white shadow-[0_-12px_48px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-neutral-200 px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[18px] font-extrabold leading-tight text-neutral-900">{dish.name}</p>
              <p className="mt-0.5 text-[13px] text-neutral-600">
                {WEEKDAYS[jsDayToWizard(line.dayOfWeek)]} · {line.mealSlot ? MEAL_SLOT_LABEL[line.mealSlot] : ''}
              </p>
              {groupCount + modCount > 0 ? (
                <p className="mt-1 text-[12px] font-semibold text-neutral-500">выберите начинку или вариант</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-[14px] font-bold text-white"
            >
              готово
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <SubscriptionDishOptionsPanel
            dish={dish}
            modifierIds={line.modifierIds ?? []}
            onChange={onChange}
            variant="sheet"
            emptyHint="У этого блюда нет настраиваемых опций в меню."
          />
        </div>

        <div
          className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
        >
          <button
            type="button"
            onClick={() => {
              onRemove()
              onClose()
            }}
            className="w-full rounded-2xl border-2 border-red-200 bg-red-50 py-3 text-[15px] font-bold text-red-700"
          >
            убрать блюдо из рациона
          </button>
        </div>
      </div>
    </div>
  )
}
