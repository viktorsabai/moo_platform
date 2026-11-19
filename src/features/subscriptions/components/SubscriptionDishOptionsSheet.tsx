'use client'

import type { Dish } from '@/types'
import { Btn, Sheet } from '@/components/kit'
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

/** Вариант/начинка блюда в рационе. Kit-шторка: открывается поверх шторки дня. */
export function SubscriptionDishOptionsSheet({ line, dish, onChange, onClose, onRemove }: Props) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div>
          <div>{dish.name}</div>
          <div className="mt-0.5 text-[13px] font-normal text-[color:var(--muted)]">
            {WEEKDAYS[jsDayToWizard(line.dayOfWeek)].toLowerCase()}
            {line.mealSlot ? ` · ${MEAL_SLOT_LABEL[line.mealSlot]}` : ''} · выберите вариант
          </div>
        </div>
      }
      footer={
        <div className="flex gap-2">
          <Btn
            variant="secondary"
            onClick={() => {
              onRemove()
              onClose()
            }}
          >
            убрать
          </Btn>
          <Btn full onClick={onClose}>
            готово
          </Btn>
        </div>
      }
    >
      <SubscriptionDishOptionsPanel
        dish={dish}
        modifierIds={line.modifierIds ?? []}
        onChange={onChange}
        variant="sheet"
        emptyHint="у этого блюда нет вариантов"
      />
    </Sheet>
  )
}
