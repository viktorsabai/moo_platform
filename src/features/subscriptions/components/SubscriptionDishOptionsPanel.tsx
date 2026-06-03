'use client'

import { useState } from 'react'
import type { Dish } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

type Props = {
  dish: Dish
  modifierIds: string[]
  onChange: (nextModifierIds: string[]) => void
  allowedOptionIds?: string[] | null
  /** Меньшие чипы, без крупных превью */
  compact?: boolean
  /** Свернуть состав до тапа */
  defaultCollapsed?: boolean
  emptyHint?: string
}

/** Панель опций блюда в конструкторе подписки (как в корзине: OPTION + чекбоксы + группы optionGroups). */
export function SubscriptionDishOptionsPanel({
  dish,
  modifierIds,
  onChange,
  allowedOptionIds,
  compact = false,
  defaultCollapsed = false,
  emptyHint,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed)
  const allowedSet = new Set((allowedOptionIds ?? []).filter(Boolean))
  const hasAllowList = allowedSet.size > 0
  const selected = new Set(
    hasAllowList ? modifierIds.filter((id) => allowedSet.has(id)) : modifierIds
  )
  const optionModifiers = (dish.modifiers || []).filter((m) => String(m.type || '').toUpperCase() === 'OPTION')
  const extraModifiers = (dish.modifiers || []).filter((m) => String(m.type || '').toUpperCase() !== 'OPTION')
  const groups = dish.optionGroups || []
  const optionModifiersFiltered = hasAllowList ? optionModifiers.filter((m) => allowedSet.has(m.id)) : optionModifiers
  const extraModifiersFiltered = hasAllowList ? extraModifiers.filter((m) => allowedSet.has(m.id)) : extraModifiers
  const groupsFiltered = hasAllowList
    ? groups
        .map((g) => ({ ...g, values: (g.values || []).filter((v) => allowedSet.has(v.id)) }))
        .filter((g) => g.values.length > 0)
    : groups

  const selectedOptionId = optionModifiersFiltered.find((m) => selected.has(m.id))?.id ?? null

  const setSelectedOption = (id: string | null) => {
    const next = new Set(modifierIds.filter((x) => !optionModifiersFiltered.some((m) => m.id === x)))
    if (id) next.add(id)
    const out = [...next]
    onChange(hasAllowList ? out.filter((x) => allowedSet.has(x)) : out)
  }

  const toggleExtra = (id: string) => {
    const next = new Set(modifierIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const out = [...next]
    onChange(hasAllowList ? out.filter((x) => allowedSet.has(x)) : out)
  }

  const pickGroupValue = (groupId: string, valueId: string | null) => {
    const group = groupsFiltered.find((g) => g.id === groupId)
    const valueIds = new Set((group?.values || []).map((v) => v.id))
    const next = modifierIds.filter((x) => !valueIds.has(x))
    if (valueId) next.push(valueId)
    onChange(hasAllowList ? next.filter((x) => allowedSet.has(x)) : next)
  }

  const hasAnyOptions =
    optionModifiersFiltered.length > 0 || extraModifiersFiltered.length > 0 || groupsFiltered.length > 0

  if (!hasAnyOptions) {
    return (
      <p className="py-4 text-center text-[14px] leading-snug text-[color:var(--muted)]">
        {emptyHint ?? 'Нет доступных опций для этого блюда.'}
      </p>
    )
  }

  const optionCount = modifierIds.filter((id) => {
    const all = [...optionModifiersFiltered, ...extraModifiersFiltered, ...groupsFiltered.flatMap((g) => g.values || [])]
    return all.some((m) => ('id' in m ? m.id : (m as { id: string }).id) === id)
  }).length

  if (defaultCollapsed && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-full border border-[color:var(--stroke)] py-1.5 text-[11px] font-semibold text-[color:var(--muted)]"
      >
        состав{optionCount > 0 ? ` · ${optionCount}` : ''} ›
      </button>
    )
  }

  const chipClass = compact
    ? 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold'
    : 'inline-flex min-h-[40px] items-center gap-2 rounded-[var(--radius-large)] border px-3 py-2 text-[14px] font-semibold'
  const imgSize = compact ? 'h-5 w-5' : 'h-7 w-7'

  return (
    <div className={cn('mt-2 space-y-2', compact ? 'border-t border-[color:var(--stroke)] pt-2' : 'space-y-3 border-t border-[color:var(--stroke)] pt-3')}>
      {defaultCollapsed ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]"
        >
          свернуть состав
        </button>
      ) : null}
      {optionModifiersFiltered.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">вариант</div>
          <div className="flex flex-wrap gap-1.5">
            {optionModifiersFiltered.map((mod) => {
              const checked = selectedOptionId === mod.id
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setSelectedOption(checked ? null : mod.id)}
                  className={cn(
                    chipClass,
                    'transition',
                    checked
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--text)]'
                      : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  {!compact && mod.subscriptionImageUrl ? (
                    <span className={cn('relative shrink-0 overflow-hidden rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]', imgSize)}>
                      <OptimizedImage
                        src={mod.subscriptionImageUrl}
                        alt={mod.name}
                        sizes="28px"
                        className="object-cover"
                        quality={72}
                      />
                    </span>
                  ) : null}
                  <span>{mod.name}</span>
                  {mod.priceAdjust > 0 && (
                    <span className="tabular-nums text-[10px] opacity-80">+{formatPrice(mod.priceAdjust)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {groupsFiltered.map((g) => (
        <div key={g.id} className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--text)]">{g.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {(g.values || []).map((v) => {
              const checked = selected.has(v.id)
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickGroupValue(g.id, checked ? null : v.id)}
                  className={cn(
                    chipClass,
                    'transition',
                    checked
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--text)]'
                      : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  {!compact && v.subscriptionImageUrl ? (
                    <span className={cn('relative shrink-0 overflow-hidden rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]', imgSize)}>
                      <OptimizedImage
                        src={v.subscriptionImageUrl}
                        alt={v.name}
                        sizes="28px"
                        className="object-cover"
                        quality={72}
                      />
                    </span>
                  ) : null}
                  <span>{v.name}</span>
                  {v.priceAdjust > 0 && (
                    <span className="tabular-nums text-[10px] opacity-80">+{formatPrice(v.priceAdjust)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {extraModifiersFiltered.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">добавить</div>
          <div className="flex flex-wrap gap-1.5">
            {extraModifiersFiltered.map((mod) => {
              const checked = selected.has(mod.id)
              return (
                <label
                  key={mod.id}
                  className={cn(
                    chipClass,
                    'cursor-pointer transition',
                    checked
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--text)]'
                      : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleExtra(mod.id)}
                    className="sr-only"
                  />
                  {!compact && mod.subscriptionImageUrl ? (
                    <span className={cn('relative shrink-0 overflow-hidden rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]', imgSize)}>
                      <OptimizedImage
                        src={mod.subscriptionImageUrl}
                        alt={mod.name}
                        sizes="20px"
                        className="object-cover"
                        quality={72}
                      />
                    </span>
                  ) : null}
                  <span>{mod.name}</span>
                  {mod.priceAdjust > 0 && (
                    <span className="tabular-nums text-[10px] opacity-80">+{formatPrice(mod.priceAdjust)}</span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
