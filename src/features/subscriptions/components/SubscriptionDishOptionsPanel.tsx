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
  /** В шите подписки — всегда все опции блюда, крупные кнопки */
  variant?: 'inline' | 'sheet'
  compact?: boolean
  defaultCollapsed?: boolean
  emptyHint?: string
}

/** Панель опций блюда в конструкторе подписки. */
export function SubscriptionDishOptionsPanel({
  dish,
  modifierIds,
  onChange,
  allowedOptionIds,
  variant = 'inline',
  compact = false,
  defaultCollapsed = false,
  emptyHint,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed)
  const isSheet = variant === 'sheet'

  const optionModifiers = (dish.modifiers || []).filter((m) => String(m.type || '').toUpperCase() === 'OPTION')
  const extraModifiers = (dish.modifiers || []).filter((m) => String(m.type || '').toUpperCase() !== 'OPTION')
  const groups = dish.optionGroups || []

  const allowedSet = isSheet ? null : new Set((allowedOptionIds ?? []).filter(Boolean))
  const hasAllowList = Boolean(allowedSet && allowedSet.size > 0)
  const selected = new Set(
    hasAllowList ? modifierIds.filter((id) => allowedSet!.has(id)) : modifierIds
  )

  const optionModifiersFiltered = hasAllowList ? optionModifiers.filter((m) => allowedSet!.has(m.id)) : optionModifiers
  const extraModifiersFiltered = hasAllowList ? extraModifiers.filter((m) => allowedSet!.has(m.id)) : extraModifiers
  const groupsFiltered = hasAllowList
    ? groups
        .map((g) => ({ ...g, values: (g.values || []).filter((v) => allowedSet!.has(v.id)) }))
        .filter((g) => g.values.length > 0)
    : groups.filter((g) => (g.values?.length ?? 0) > 0)

  const selectedOptionId = optionModifiersFiltered.find((m) => selected.has(m.id))?.id ?? null

  const setSelectedOption = (id: string | null) => {
    const next = new Set(modifierIds.filter((x) => !optionModifiersFiltered.some((m) => m.id === x)))
    if (id) next.add(id)
    const out = [...next]
    onChange(hasAllowList ? out.filter((x) => allowedSet!.has(x)) : out)
  }

  const toggleExtra = (id: string) => {
    const next = new Set(modifierIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const out = [...next]
    onChange(hasAllowList ? out.filter((x) => allowedSet!.has(x)) : out)
  }

  const pickGroupValue = (groupId: string, valueId: string | null) => {
    const group = groupsFiltered.find((g) => g.id === groupId)
    const valueIds = new Set((group?.values || []).map((v) => v.id))
    const next = modifierIds.filter((x) => !valueIds.has(x))
    if (valueId) next.push(valueId)
    onChange(hasAllowList ? next.filter((x) => allowedSet!.has(x)) : next)
  }

  const hasAnyOptions =
    optionModifiersFiltered.length > 0 || extraModifiersFiltered.length > 0 || groupsFiltered.length > 0

  if (!hasAnyOptions) {
    return (
      <p
        className={cn(
          'py-4 text-center leading-snug',
          isSheet ? 'text-[15px] font-medium text-neutral-700' : 'text-[14px] text-[color:var(--muted)]'
        )}
      >
        {emptyHint ?? 'Нет доступных опций для этого блюда.'}
      </p>
    )
  }

  if (isSheet) {
    return (
      <div className="space-y-5 pb-2">
        {groupsFiltered.map((g) => (
          <div key={g.id}>
            <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-neutral-800">{g.name}</p>
            <div className="flex flex-col gap-2">
              {(g.values || []).map((v) => {
                const checked = selected.has(v.id)
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => pickGroupValue(g.id, checked ? null : v.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition active:scale-[0.99]',
                      checked
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-900'
                    )}
                  >
                    <span className="text-[16px] font-bold leading-tight">{v.name}</span>
                    {v.priceAdjust > 0 ? (
                      <span className={cn('shrink-0 text-[14px] font-bold tabular-nums', checked ? 'text-white/90' : 'text-neutral-600')}>
                        +{formatPrice(v.priceAdjust)}
                      </span>
                    ) : (
                      <span className={cn('shrink-0 text-[12px] font-semibold', checked ? 'text-white/80' : 'text-neutral-500')}>
                        {checked ? 'выбрано' : 'выбрать'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {optionModifiersFiltered.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-neutral-800">вариант</p>
            <div className="flex flex-col gap-2">
              {optionModifiersFiltered.map((mod) => {
                const checked = selectedOptionId === mod.id
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setSelectedOption(checked ? null : mod.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-[16px] font-bold',
                      checked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-900'
                    )}
                  >
                    <span>{mod.name}</span>
                    {mod.priceAdjust > 0 ? <span>+{formatPrice(mod.priceAdjust)}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {extraModifiersFiltered.length > 0 && (
          <div>
            <p className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-neutral-800">добавить</p>
            <div className="flex flex-col gap-2">
              {extraModifiersFiltered.map((mod) => {
                const checked = selected.has(mod.id)
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleExtra(mod.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-[16px] font-bold',
                      checked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-900'
                    )}
                  >
                    <span>{mod.name}</span>
                    {mod.priceAdjust > 0 ? <span>+{formatPrice(mod.priceAdjust)}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
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
                      <OptimizedImage src={mod.subscriptionImageUrl} alt={mod.name} sizes="28px" className="object-cover" quality={72} />
                    </span>
                  ) : null}
                  <span>{mod.name}</span>
                  {mod.priceAdjust > 0 && <span className="tabular-nums text-[10px] opacity-80">+{formatPrice(mod.priceAdjust)}</span>}
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
                      <OptimizedImage src={v.subscriptionImageUrl} alt={v.name} sizes="28px" className="object-cover" quality={72} />
                    </span>
                  ) : null}
                  <span>{v.name}</span>
                  {v.priceAdjust > 0 && <span className="tabular-nums text-[10px] opacity-80">+{formatPrice(v.priceAdjust)}</span>}
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
                  <input type="checkbox" checked={checked} onChange={() => toggleExtra(mod.id)} className="sr-only" />
                  <span>{mod.name}</span>
                  {mod.priceAdjust > 0 && <span className="tabular-nums text-[10px] opacity-80">+{formatPrice(mod.priceAdjust)}</span>}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
