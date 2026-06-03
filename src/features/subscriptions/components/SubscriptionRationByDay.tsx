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
  jsDayToWizard,
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
  const daysWithLines = useMemo(() => {
    return selectedDays.filter((w) => lines.some((l) => l.dayOfWeek === wizardDayToJs(w)))
  }, [lines, selectedDays])

  const [activeWizardDay, setActiveWizardDay] = useState(daysWithLines[0] ?? selectedDays[0] ?? 0)
  const dayLines = lines.filter((l) => l.dayOfWeek === wizardDayToJs(activeWizardDay))

  const [activeLineKey, setActiveLineKey] = useState<string | null>(dayLines[0] ? lineKey(dayLines[0]) : null)
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

      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {selectedDays.map((w) => {
          const js = wizardDayToJs(w)
          const count = lines.filter((l) => l.dayOfWeek === js).length
          const thumbs = lines.filter((l) => l.dayOfWeek === js).slice(0, 3)
          const current = w === activeWizardDay
          return (
            <button
              key={w}
              type="button"
              onClick={() => {
                setActiveWizardDay(w)
                const first = lines.find((l) => l.dayOfWeek === js)
                setActiveLineKey(first ? lineKey(first) : null)
              }}
              className={cn(
                'flex w-[108px] shrink-0 flex-col rounded-[var(--radius-medium)] border p-2 text-left transition',
                current ? 'border-[color:var(--text)] bg-[color:var(--text)]/[0.03]' : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'
              )}
            >
              <span className="text-[12px] font-extrabold">{WEEKDAYS[w]}</span>
              <span className="mt-0.5 text-[10px] font-semibold text-[color:var(--muted)]">{count || '—'} блюд</span>
              <div className="mt-2 flex -space-x-1.5">
                {thumbs.map((l) => {
                  const d = dishes.find((x) => x.id === l.dishId)
                  return (
                    <span
                      key={lineKey(l)}
                      className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-[color:var(--surface)] bg-black/[0.04]"
                    >
                      {d?.image ? <OptimizedImage src={d.image} alt="" className="object-cover" sizes="28px" /> : null}
                    </span>
                  )
                })}
              </div>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onAddMore}
          className="flex w-[72px] shrink-0 flex-col items-center justify-center rounded-[var(--radius-medium)] border border-dashed border-[color:var(--stroke)] text-[color:var(--muted)]"
        >
          <span className="text-[22px] font-light leading-none">+</span>
          <span className="mt-1 text-[10px] font-semibold">ещё</span>
        </button>
      </div>

      {dayLines.length > 0 ? (
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  'relative w-[76px] shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius-medium)] border text-left',
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
                <p className="truncate px-1 py-1 text-[9px] font-semibold leading-tight">{dish.name}</p>
              </div>
            )
          })}
        </div>
      ) : null}

      {activeLine && activeDish ? (
        <div className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3">
          <div className="flex items-start gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
              {activeDish.image ? (
                <OptimizedImage src={activeDish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold leading-tight">{activeDish.name}</p>
              <p className="text-[11px] text-[color:var(--muted)]">
                {WEEKDAYS[jsDayToWizard(activeLine.dayOfWeek)]} · {mealSlotShort(activeLine.mealSlot)}
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
      ) : null}
    </section>
  )
}
