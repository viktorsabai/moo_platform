'use client'

import { useMemo, useState } from 'react'
import type { Dish } from '@/types'
import { cn } from '@/lib/utils'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { SubscriptionDishOptionsPanel } from '@/features/subscriptions/components/SubscriptionDishOptionsPanel'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import {
  WEEKDAYS,
  allowedOptionIdsForLine,
  lineKey,
  mealSlotShort,
  wizardDayToJs,
  type SelectedLine,
} from '@/features/subscriptions/lib/subscription-checkout-utils'

type Props = {
  lines: SelectedLine[]
  dishes: Dish[]
  selectedDays: number[]
  subConfig: SubscriptionConfig
  onRemoveLine: (line: SelectedLine) => void
  onUpdateQty: (line: SelectedLine, delta: number) => void
  onLineModifiers: (line: SelectedLine, ids: string[]) => void
  onAddMore: () => void
}

export function SubscriptionRationByDay({
  lines,
  dishes,
  selectedDays,
  subConfig,
  onRemoveLine,
  onUpdateQty,
  onLineModifiers,
  onAddMore,
}: Props) {
  const [activeWizardDay, setActiveWizardDay] = useState(selectedDays[0] ?? 0)
  const jsDay = wizardDayToJs(activeWizardDay)
  const dayLines = useMemo(() => lines.filter((l) => l.dayOfWeek === jsDay), [lines, jsDay])

  const [activeLineKey, setActiveLineKey] = useState<string | null>(null)
  const activeLine = dayLines.find((l) => lineKey(l) === activeLineKey) ?? dayLines[0] ?? null
  const activeDish = activeLine ? dishes.find((d) => d.id === activeLine.dishId) : null

  if (!selectedDays.length) return null

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-extrabold">ваш рацион</h3>
        <button type="button" onClick={onAddMore} className="text-[12px] font-bold text-[color:var(--muted)] underline-offset-2 hover:underline">
          изменить
        </button>
      </div>

      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {selectedDays.map((w) => {
          const count = lines.filter((l) => l.dayOfWeek === wizardDayToJs(w)).length
          const current = w === activeWizardDay
          return (
            <button
              key={w}
              type="button"
              onClick={() => {
                setActiveWizardDay(w)
                setActiveLineKey(null)
              }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums',
                current
                  ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                  : 'border border-[color:var(--stroke)] text-[color:var(--muted)]'
              )}
            >
              {WEEKDAYS[w]}
              {count > 0 ? ` · ${count}` : ''}
            </button>
          )
        })}
      </div>

      {dayLines.length > 0 ? (
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dayLines.map((l) => {
            const dish = dishes.find((d) => d.id === l.dishId)
            if (!dish) return null
            const k = lineKey(l)
            const current = activeLine && lineKey(activeLine) === k
            return (
              <div
                key={k}
                role="button"
                tabIndex={0}
                onClick={() => setActiveLineKey(k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setActiveLineKey(k)
                }}
                className={cn(
                  'relative w-[72px] shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius-medium)] border',
                  current ? 'border-[color:var(--text)]' : 'border-[color:var(--stroke)]'
                )}
              >
                <div className="relative aspect-square w-full bg-black/[0.04]">
                  {dish.image ? (
                    <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.checkoutThumb} />
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveLine(l)
                    }}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[10px] font-bold text-white"
                    aria-label="убрать"
                  >
                    ×
                  </button>
                </div>
                <p className="truncate px-1 py-0.5 text-[9px] font-semibold">{dish.name}</p>
              </div>
            )
          })}
        </div>
      ) : null}

      {activeLine && activeDish ? (
        <div className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3">
          <div className="flex items-start gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
              {activeDish.image ? (
                <OptimizedImage src={activeDish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold leading-tight">{activeDish.name}</p>
              <p className="text-[11px] text-[color:var(--muted)]">
                {mealSlotShort(activeLine.mealSlot)}
              </p>
            </div>
            <InlineCounter value={activeLine.quantity} onDec={() => onUpdateQty(activeLine, -1)} onInc={() => onUpdateQty(activeLine, 1)} />
          </div>
          <SubscriptionDishOptionsPanel
            dish={activeDish}
            modifierIds={activeLine.modifierIds ?? []}
            allowedOptionIds={allowedOptionIdsForLine(subConfig, activeLine.mealSlot)}
            onChange={(ids) => onLineModifiers(activeLine, ids)}
            compact
            defaultCollapsed
          />
        </div>
      ) : (
        <p className="text-[12px] text-[color:var(--muted)]">На {WEEKDAYS[activeWizardDay]} блюд нет</p>
      )}
    </section>
  )
}
