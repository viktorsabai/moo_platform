'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { MEAL_SLOT_IDS, MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import type { SubscriptionConfig, SubscriptionCommerceConfig } from '@/lib/subscription-config'
import { defaultSubscriptionConfig } from '@/lib/subscription-config'

type CatalogDish = {
  id: string
  name: string
  price: number
  costPrice: number | null
  categoryId: string
  emoji?: string | null
}

type QuotePreview = {
  recommendedPrice: number
  guestPrice: number
  periodRetail: number
  guestSavings: number
  guestSavingsPercent: number
  ownerMargin: number
  ownerMarginPercent: number
  missingCostCount: number
}

export function AdminSubscriptionCatalog() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [dishes, setDishes] = useState<CatalogDish[]>([])
  const [activeSlot, setActiveSlot] = useState<MealSlot>('lunch')
  const [quote, setQuote] = useState<QuotePreview | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/subscriptions/config', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setConfig(data.config ?? defaultSubscriptionConfig())
        setDishes(Array.isArray(data.dishes) ? data.dishes : [])
      } else {
        toast.error(data?.error || 'Не удалось загрузить конфиг подписок')
      }
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const previewItems = useMemo(() => {
    const items: { dishId: string; quantity: number; mealSlot: MealSlot }[] = []
    for (const slot of MEAL_SLOT_IDS) {
      const sc = config.mealSlots[slot]
      if (!sc?.enabled) continue
      const ids = sc.defaultDishIds.length ? sc.defaultDishIds : sc.dishIds
      for (const dishId of ids.slice(0, sc.maxItemsPerDelivery)) {
        items.push({ dishId, quantity: 1, mealSlot: slot })
      }
    }
    return items
  }, [config])

  useEffect(() => {
    if (previewItems.length === 0) {
      setQuote(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/subscriptions/config', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: previewItems,
            deliveryDays: config.minDaysPerWeek,
            periodDays: config.defaultPeriodDays,
            personCount: 1,
            ownerPriceOverride: config.ownerPriceOverride ?? null,
          }),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok && data.quote) setQuote(data.quote)
      } catch {
        setQuote(null)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [previewItems, config.minDaysPerWeek, config.defaultPeriodDays, config.ownerPriceOverride])

  async function save(next?: SubscriptionConfig) {
    const payload = next ?? config
    setSaving(true)
    try {
      const res = await fetch('/api/admin/subscriptions/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: payload }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не сохранено')
        return
      }
      setConfig(data.config)
      toast.success('Настройки подписок сохранены')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  function patchSlot(slot: MealSlot, patch: Partial<SubscriptionConfig['mealSlots'][MealSlot]>) {
    setConfig((prev) => ({
      ...prev,
      mealSlots: {
        ...prev.mealSlots,
        [slot]: { ...prev.mealSlots[slot], ...patch },
      },
    }))
  }

  function toggleDishInSlot(slot: MealSlot, dishId: string) {
    setConfig((prev) => {
      const sc = prev.mealSlots[slot]
      const has = sc.dishIds.includes(dishId)
      const dishIds = has ? sc.dishIds.filter((id) => id !== dishId) : [...sc.dishIds, dishId]
      const defaultDishIds = sc.defaultDishIds.filter((id) => dishIds.includes(id))
      return {
        ...prev,
        mealSlots: {
          ...prev.mealSlots,
          [slot]: { ...sc, dishIds, defaultDishIds },
        },
      }
    })
  }

  function toggleDefaultDish(slot: MealSlot, dishId: string) {
    setConfig((prev) => {
      const sc = prev.mealSlots[slot]
      if (!sc.dishIds.includes(dishId)) return prev
      const has = sc.defaultDishIds.includes(dishId)
      const defaultDishIds = has
        ? sc.defaultDishIds.filter((id) => id !== dishId)
        : [...sc.defaultDishIds, dishId].slice(0, sc.maxItemsPerDelivery)
      return {
        ...prev,
        mealSlots: { ...prev.mealSlots, [slot]: { ...sc, defaultDishIds } },
      }
    })
  }

  function patchCommerce(patch: Partial<SubscriptionCommerceConfig>) {
    setConfig((prev) => ({ ...prev, commerce: { ...prev.commerce, ...patch } }))
  }

  const slotDishes = dishes.filter((d) => {
    const sc = config.mealSlots[activeSlot]
    if (!sc.dishIds.length) return true
    return sc.dishIds.includes(d.id)
  })

  if (loading) {
    return <p className="ui-muted py-6 text-[13px]">Загрузка каталога подписок…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[15px] font-extrabold tracking-tight">Каталог подписки</p>
        <p className="ui-muted mt-1 text-[12px]">
          Блюда с отметкой «доступно для подписки» в меню. Распределите по слотам — гость соберёт рацион в этих рамках.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MEAL_SLOT_IDS.map((slot) => {
          const sc = config.mealSlots[slot]
          const active = activeSlot === slot
          return (
            <button
              key={slot}
              type="button"
              onClick={() => setActiveSlot(slot)}
              className={cn(
                'rounded-full border px-4 py-2 text-[13px] font-semibold transition',
                active ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10' : 'border-[color:var(--stroke)]'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {MEAL_SLOT_LABEL[slot]}
              {sc.enabled ? ` · ${sc.dishIds.length || 'все'}` : ' · выкл'}
            </button>
          )
        })}
      </div>

      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: 'var(--stroke)', borderRadius: 'var(--radius-large)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input
              type="checkbox"
              checked={config.mealSlots[activeSlot].enabled}
              onChange={(e) => patchSlot(activeSlot, { enabled: e.target.checked })}
            />
            Слот «{MEAL_SLOT_LABEL[activeSlot]}» включён
          </label>
          <label className="flex items-center gap-2 text-[12px]">
            <span className="text-[color:var(--muted)]">макс. блюд за доставку</span>
            <input
              type="number"
              min={0}
              max={10}
              value={config.mealSlots[activeSlot].maxItemsPerDelivery}
              onChange={(e) => patchSlot(activeSlot, { maxItemsPerDelivery: Number(e.target.value) || 0 })}
              className="input w-16 rounded-lg px-2 py-1 text-center text-[13px]"
            />
          </label>
        </div>

        {dishes.length === 0 ? (
          <p className="ui-muted mt-4 text-[13px]">Нет блюд с отметкой «доступно для подписки». Включите в меню.</p>
        ) : (
          <ul className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
            {dishes.map((d) => {
              const sc = config.mealSlots[activeSlot]
              const inSlot = sc.dishIds.length === 0 || sc.dishIds.includes(d.id)
              const checked = sc.dishIds.includes(d.id) || sc.dishIds.length === 0
              const isDefault = sc.defaultDishIds.includes(d.id)
              const noCost = d.costPrice == null || d.costPrice <= 0
              return (
                <li
                  key={d.id}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[13px]',
                    inSlot ? 'border-[color:var(--stroke)]' : 'border-transparent opacity-40'
                  )}
                  style={{ borderRadius: 'var(--radius-medium)' }}
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sc.dishIds.length === 0 ? false : sc.dishIds.includes(d.id)}
                      onChange={() => {
                        if (sc.dishIds.length === 0) {
                          patchSlot(activeSlot, { dishIds: [d.id] })
                        } else {
                          toggleDishInSlot(activeSlot, d.id)
                        }
                      }}
                    />
                    <span className="truncate font-medium">
                      {d.emoji ? `${d.emoji} ` : ''}{d.name}
                    </span>
                    <span className="shrink-0 text-[color:var(--muted)]">{formatPrice(d.price)}</span>
                    {noCost ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        нет себест.
                      </span>
                    ) : null}
                  </label>
                  {checked && sc.dishIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleDefaultDish(activeSlot, d.id)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        isDefault ? 'bg-[color:var(--primary)] text-white' : 'bg-black/5 text-black/55'
                      )}
                      style={{ borderRadius: 'var(--radius-pill)' }}
                    >
                      {isDefault ? '★ default' : 'default'}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {config.mealSlots[activeSlot].dishIds.length === 0 && dishes.length > 0 ? (
          <p className="ui-muted mt-2 text-[11px]">Пустой список = все eligible-блюда доступны в этом слоте.</p>
        ) : null}
      </div>

      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: 'var(--stroke)', borderRadius: 'var(--radius-large)' }}
      >
        <p className="text-[14px] font-extrabold">Коммерция</p>
        <p className="ui-muted mt-1 text-[12px]">Рекомендуемая цена считается от себестоимости и скидки гостю.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(
            [
              ['targetMarginPercent', 'Целевая маржа, %', config.commerce.targetMarginPercent],
              ['subscriptionDiscountPercent', 'Скидка гостю, %', config.commerce.subscriptionDiscountPercent],
              ['minMarginPercent', 'Мин. маржа, %', config.commerce.minMarginPercent],
              ['priceRoundTo', 'Округление, ฿', config.commerce.priceRoundTo],
            ] as const
          ).map(([key, label, val]) => (
            <label key={key} className="block text-[12px]">
              <span className="font-semibold text-[color:var(--muted)]">{label}</span>
              <input
                type="number"
                value={val}
                onChange={(e) => patchCommerce({ [key]: Number(e.target.value) || 0 } as Partial<SubscriptionCommerceConfig>)}
                className="input mt-1 w-full rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-[12px]">
            <span className="font-semibold text-[color:var(--muted)]">мин. дней/нед</span>
            <input
              type="number"
              min={1}
              max={7}
              value={config.minDaysPerWeek}
              onChange={(e) => setConfig((p) => ({ ...p, minDaysPerWeek: Number(e.target.value) || 1 }))}
              className="input mt-1 w-full rounded-lg px-3 py-2 text-[13px]"
            />
          </label>
          <label className="text-[12px]">
            <span className="font-semibold text-[color:var(--muted)]">макс. дней/нед</span>
            <input
              type="number"
              min={1}
              max={7}
              value={config.maxDaysPerWeek}
              onChange={(e) => setConfig((p) => ({ ...p, maxDaysPerWeek: Number(e.target.value) || 7 }))}
              className="input mt-1 w-full rounded-lg px-3 py-2 text-[13px]"
            />
          </label>
          <label className="text-[12px]">
            <span className="font-semibold text-[color:var(--muted)]">персон (макс)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={config.maxPersons}
              onChange={(e) => setConfig((p) => ({ ...p, maxPersons: Number(e.target.value) || 4 }))}
              className="input mt-1 w-full rounded-lg px-3 py-2 text-[13px]"
            />
          </label>
        </div>
        {quote ? (
          <div
            className="mt-4 rounded-xl p-3 text-[13px]"
            style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', borderRadius: 'var(--radius-medium)' }}
          >
            <p className="font-semibold">
              При типичном рационе:{' '}
              <strong>{formatPrice(quote.guestPrice)}</strong>
              <span className="font-normal text-[color:var(--muted)]"> / {config.defaultPeriodDays} дн.</span>
            </p>
            <p className="mt-1">
              Маржа: <strong>{Math.round(quote.ownerMarginPercent)}%</strong>
              {quote.guestSavingsPercent > 0 ? (
                <span className="ml-2 text-[color:var(--accent)]">
                  · гость экономит {Math.round(quote.guestSavingsPercent)}% vs разовые заказы
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-[12px] text-[color:var(--muted)]">
              Рекомендуемая: {formatPrice(quote.recommendedPrice)}
              {quote.missingCostCount > 0 ? ` · ${quote.missingCostCount} поз. без себестоимости` : ''}
            </p>
          </div>
        ) : null}
        <label className="mt-4 block text-[12px]">
          <span className="font-semibold text-[color:var(--muted)]">Финальная цена за период, ฿ (опционально)</span>
          <input
            type="number"
            min={0}
            placeholder="авто из маржи"
            value={config.ownerPriceOverride ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim()
              setConfig((p) => ({
                ...p,
                ownerPriceOverride: raw === '' ? null : Math.max(0, Math.round(Number(raw) || 0)) || null,
              }))
            }}
            className="input mt-1 w-full rounded-lg px-3 py-2 text-[13px]"
          />
          <span className="mt-1 block text-[11px] text-[color:var(--muted)]">
            Не ниже мин. маржи ({config.commerce.minMarginPercent}%). Пусто — считаем автоматически.
          </span>
        </label>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="btn btn-primary w-full rounded-full py-3 text-[14px] font-semibold disabled:opacity-50 sm:w-auto sm:px-8"
        style={{ borderRadius: 'var(--radius-pill)' }}
      >
        {saving ? 'сохраняем…' : 'сохранить каталог и коммерцию'}
      </button>
    </div>
  )
}
