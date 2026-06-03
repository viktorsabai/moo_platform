'use client'

import { useMemo, useState } from 'react'
import type { Dish } from '@/types'
import { cn } from '@/lib/utils'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { SubscriptionDishOptionsPanel } from '@/features/subscriptions/components/SubscriptionDishOptionsPanel'
import { SubscriptionRationStrip } from '@/features/subscriptions/components/SubscriptionRationStrip'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import {
  WEEKDAYS,
  allowedOptionIdsForLine,
  dishHasConfigurableOptions,
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
  onRemoveLine: (line: SelectedLine) => void
  onUpdateQty: (line: SelectedLine, delta: number) => void
  onLineModifiers: (line: SelectedLine, ids: string[]) => void
  onEditRation: () => void
}

export function SubscriptionRationByDay({
  lines,
  dishes,
  selectedDays,
  slotsByWizardDay,
  enabledSlots,
  subConfig,
  summaryLine,
  onRemoveLine,
  onUpdateQty,
  onLineModifiers,
  onEditRation,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeWizardDay, setActiveWizardDay] = useState(selectedDays[0] ?? 0)
  const jsDay = wizardDayToJs(activeWizardDay)
  const slotOrder = slotsForWizardDay(slotsByWizardDay, activeWizardDay, enabledSlots)
  const groups = useMemo(() => groupDayLinesByMealSlot(lines, jsDay, slotOrder), [lines, jsDay, slotOrder])

  const stripLines = useMemo(
    () =>
      lines.slice(0, 12).map((l) => {
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

  if (!selectedDays.length) return null

  return (
    <section className="mb-4 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold leading-tight">рацион</p>
          {summaryLine ? <p className="text-[11px] text-[color:var(--muted)]">{summaryLine}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onEditRation} className="text-[12px] font-bold text-[color:var(--muted)] underline-offset-2 hover:underline">
            изменить
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-[color:var(--stroke)] px-2.5 py-1 text-[11px] font-bold"
            aria-expanded={expanded}
          >
            {expanded ? 'свернуть' : 'детали'}
          </button>
        </div>
      </div>

      <div className="px-3 pb-3 pt-2">
        <SubscriptionRationStrip lines={stripLines} dense className="mx-0" />

        {expanded ? (
          <>
            <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {selectedDays.map((w) => {
                const count = lines.filter((l) => l.dayOfWeek === wizardDayToJs(w)).length
                const current = w === activeWizardDay
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setActiveWizardDay(w)}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums',
                      current ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
                    )}
                  >
                    {WEEKDAYS[w]}
                    {count > 0 ? ` · ${count}` : ''}
                  </button>
                )
              })}
            </div>

            {groups.length > 0 ? (
              <ul className="mt-2 space-y-3">
                {groups.map(({ slot, items }) => (
                  <li key={slot ?? 'other'}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                      {slot ? MEAL_SLOT_LABEL[slot] : 'блюда'}
                    </p>
                    <ul className="space-y-1.5">
                      {items.map((l) => {
                        const dish = dishes.find((d) => d.id === l.dishId)
                        if (!dish) return null
                        const hasOptions = dishHasConfigurableOptions(dish)
                        return (
                          <li
                            key={lineKey(l)}
                            className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-2 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
                                {dish.image ? (
                                  <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
                                ) : (
                                  <span className="flex h-full items-center justify-center text-[14px]">🍽</span>
                                )}
                              </div>
                              <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">{dish.name}</p>
                              <InlineCounter value={l.quantity} onDec={() => onUpdateQty(l, -1)} onInc={() => onUpdateQty(l, 1)} />
                              <button
                                type="button"
                                onClick={() => onRemoveLine(l)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] text-[color:var(--muted)]"
                                aria-label="убрать"
                              >
                                ×
                              </button>
                            </div>
                            {hasOptions ? (
                              <div className="mt-1.5 border-t border-[color:var(--stroke)] pt-1.5">
                                <SubscriptionDishOptionsPanel
                                  dish={dish}
                                  modifierIds={l.modifierIds ?? []}
                                  allowedOptionIds={allowedOptionIdsForLine(subConfig, l.mealSlot)}
                                  onChange={(ids) => onLineModifiers(l, ids)}
                                  compact
                                  defaultCollapsed
                                />
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-[color:var(--muted)]">На {WEEKDAYS[activeWizardDay]} блюд нет</p>
            )}
          </>
        ) : null}
      </div>
    </section>
  )
}
