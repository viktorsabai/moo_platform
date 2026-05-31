'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { MEAL_SLOT_IDS, MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import {
  defaultSubscriptionConfig,
  getEnabledMealSlots,
  type SubscriptionConfig,
} from '@/lib/subscription-config'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { EmptyStatePlaceholder } from '@/components/ui/EmptyStatePlaceholder'

export type CatalogProduct = {
  kind: 'dish' | 'option'
  id: string
  name: string
  emoji?: string | null
  categoryName: string
  price: number
  costPrice: number | null
  image?: string | null
  dishId: string
  parentDishName?: string | null
}

type QuotePreview = {
  guestPrice: number
  periodRetail: number
  guestSavingsPercent: number
  ownerMargin: number
  ownerMarginPercent: number
  recommendedPrice: number
  perDeliveryCost: number
  deliveriesInPeriod: number
  missingCostCount: number
}

function productKey(p: CatalogProduct) {
  return `${p.kind}:${p.id}`
}

function buildQuoteItems(config: SubscriptionConfig, products: CatalogProduct[]) {
  const dishProducts = products.filter((p) => p.kind === 'dish')
  const items: { dishId: string; quantity: number; mealSlot: MealSlot; modifierIds: string[] }[] = []

  for (const slot of MEAL_SLOT_IDS) {
    const sc = config.mealSlots[slot]
    if (!sc?.enabled) continue
    const pool = sc.dishIds.length ? sc.dishIds : dishProducts.map((d) => d.id)
    for (const dishId of pool) {
      const limit = sc.dishLimits?.[dishId] ?? sc.maxItemsPerDelivery ?? 1
      if (limit <= 0) continue
      const optionMods = (sc.optionIds ?? []).slice(0, 3)
      items.push({
        dishId,
        quantity: limit,
        mealSlot: slot,
        modifierIds: optionMods,
      })
    }
  }
  return items
}

function worstCaseProductCost(config: SubscriptionConfig, products: CatalogProduct[]): number {
  let total = 0
  for (const slot of MEAL_SLOT_IDS) {
    const sc = config.mealSlots[slot]
    if (!sc?.enabled) continue
    const dishPool = sc.dishIds.length
      ? products.filter((p) => p.kind === 'dish' && sc.dishIds.includes(p.id))
      : products.filter((p) => p.kind === 'dish')
    if (!dishPool.length) continue
    const sorted = [...dishPool].sort((a, b) => (b.costPrice ?? b.price) - (a.costPrice ?? a.price))
    const top = sorted[0]
    const cost = top?.costPrice ?? top?.price ?? 0
    const limit = sc.maxItemsPerDelivery || 1
    total += cost * limit
  }
  return total
}

function marginBadge(percent: number, minMargin: number) {
  if (percent >= minMargin + 15) return { label: `${Math.round(percent)}% 🔥 безопасная зона`, tone: 'safe' as const }
  if (percent >= minMargin) return { label: `${Math.round(percent)}% ✓ норма`, tone: 'ok' as const }
  return { label: `${Math.round(percent)}% ⚠ ниже минимума`, tone: 'danger' as const }
}

export function AdminSubscriptionDashboard() {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [config, setConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<MealSlot>('lunch')
  const [quote, setQuote] = useState<QuotePreview | null>(null)
  const [manualPriceOpen, setManualPriceOpen] = useState(false)
  const [costPopoverKey, setCostPopoverKey] = useState<string | null>(null)
  const [costDraft, setCostDraft] = useState('')

  const activeProduct = products[activeIndex] ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, settingsRes] = await Promise.all([
        fetch('/api/admin/subscriptions/config', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' }),
      ])
      const cfgData = await cfgRes.json().catch(() => null)
      const settingsData = await settingsRes.json().catch(() => null)
      if (settingsRes.ok && settingsData?.ok) {
        setSubscriptionEnabled(Boolean(settingsData.settings?.subscriptionEnabled))
      }
      if (cfgRes.ok && cfgData?.ok) {
        setConfig(cfgData.config ?? defaultSubscriptionConfig())
        setProducts(Array.isArray(cfgData.products) ? cfgData.products : [])
        const slots = getEnabledMealSlots(cfgData.config ?? defaultSubscriptionConfig())
        if (slots.length) setActiveSlot(slots[0])
      } else {
        toast.error(cfgData?.error || 'Не удалось загрузить каталог')
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

  const previewItems = useMemo(() => buildQuoteItems(config, products), [config, products])

  useEffect(() => {
    if (!previewItems.length) {
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
            periodDays: 7,
            personCount: 1,
            ownerPriceOverride: config.ownerPriceOverride ?? null,
            commerce: config.commerce,
          }),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok && data.quote) setQuote(data.quote)
      } catch {
        setQuote(null)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [previewItems, config.minDaysPerWeek, config.ownerPriceOverride, config.commerce])

  const weeklyGuestPrice = quote ? Math.round(quote.guestPrice) : 0
  const weeklyRetail = quote ? Math.round(quote.periodRetail * (7 / (config.defaultPeriodDays || 7))) : 0
  const worstPerDelivery = worstCaseProductCost(config, products)
  const margin = quote ? marginBadge(quote.ownerMarginPercent, config.commerce.minMarginPercent) : null

  const minAllowedPrice = useMemo(() => {
    if (!quote || quote.perDeliveryCost <= 0) return 0
    const deliveries = Math.max(1, Math.round(config.minDaysPerWeek * (7 / 7)))
    return Math.round(
      quote.perDeliveryCost * (1 + config.commerce.minMarginPercent / 100) * deliveries
    )
  }, [quote, config.commerce.minMarginPercent, config.minDaysPerWeek])

  const manualPriceInvalid =
    manualPriceOpen &&
    config.ownerPriceOverride != null &&
    config.ownerPriceOverride > 0 &&
    minAllowedPrice > 0 &&
    config.ownerPriceOverride < minAllowedPrice

  function patchConfig(next: SubscriptionConfig) {
    setConfig(next)
  }

  function patchSlot(slot: MealSlot, patch: Partial<SubscriptionConfig['mealSlots'][MealSlot]>) {
    setConfig((prev) => ({
      ...prev,
      mealSlots: { ...prev.mealSlots, [slot]: { ...prev.mealSlots[slot], ...patch } },
    }))
  }

  function isInSlot(p: CatalogProduct, slot: MealSlot) {
    const sc = config.mealSlots[slot]
    if (p.kind === 'dish') return sc.dishIds.includes(p.id)
    return (sc.optionIds ?? []).includes(p.id)
  }

  function dishLimit(p: CatalogProduct, slot: MealSlot) {
    if (p.kind !== 'dish') return 1
    return config.mealSlots[slot].dishLimits?.[p.id] ?? config.mealSlots[slot].maxItemsPerDelivery ?? 1
  }

  function assignToSlot(p: CatalogProduct, slot: MealSlot) {
    setConfig((prev) => {
      let mealSlots = { ...prev.mealSlots }
      for (const s of MEAL_SLOT_IDS) {
        if (s === slot) continue
        const sc = mealSlots[s]
        if (p.kind === 'dish') {
          mealSlots[s] = {
            ...sc,
            dishIds: sc.dishIds.filter((id) => id !== p.id),
            defaultDishIds: sc.defaultDishIds.filter((id) => id !== p.id),
            dishLimits: Object.fromEntries(
              Object.entries(sc.dishLimits ?? {}).filter(([id]) => id !== p.id)
            ),
          }
        } else {
          mealSlots[s] = {
            ...sc,
            optionIds: (sc.optionIds ?? []).filter((id) => id !== p.id),
          }
        }
      }

      const sc = mealSlots[slot]
      if (p.kind === 'dish') {
        const has = sc.dishIds.includes(p.id)
        const dishIds = has ? sc.dishIds.filter((id) => id !== p.id) : [...sc.dishIds, p.id]
        const dishLimits = { ...(sc.dishLimits ?? {}) }
        if (!has) dishLimits[p.id] = dishLimits[p.id] ?? sc.maxItemsPerDelivery ?? 1
        else delete dishLimits[p.id]
        mealSlots[slot] = {
          ...sc,
          enabled: true,
          dishIds,
          dishLimits,
          defaultDishIds: has
            ? sc.defaultDishIds.filter((id) => id !== p.id)
            : [...sc.defaultDishIds, p.id].slice(0, 3),
        }
      } else {
        const opts = sc.optionIds ?? []
        const has = opts.includes(p.id)
        mealSlots[slot] = {
          ...sc,
          enabled: true,
          optionIds: has ? opts.filter((id) => id !== p.id) : [...opts, p.id],
        }
      }
      return { ...prev, mealSlots }
    })
    setActiveSlot(slot)
  }

  function setDishLimit(p: CatalogProduct, slot: MealSlot, next: number) {
    if (p.kind !== 'dish') return
    const lim = Math.max(1, Math.min(10, next))
    patchSlot(slot, {
      dishLimits: { ...(config.mealSlots[slot].dishLimits ?? {}), [p.id]: lim },
      enabled: true,
      dishIds: config.mealSlots[slot].dishIds.includes(p.id)
        ? config.mealSlots[slot].dishIds
        : [...config.mealSlots[slot].dishIds, p.id],
    })
  }

  async function saveCostPrice(p: CatalogProduct, value: number | null) {
    try {
      const res = await fetch('/api/admin/subscriptions/product-cost', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: p.kind,
          id: p.id,
          dishId: p.dishId,
          costPrice: value,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не сохранено')
        return
      }
      setProducts((prev) =>
        prev.map((x) =>
          productKey(x) === productKey(p) ? { ...x, costPrice: data.costPrice ?? value } : x
        )
      )
      setCostPopoverKey(null)
      toast.success('Себестоимость обновлена')
    } catch {
      toast.error('Ошибка сети')
    }
  }

  async function saveAll() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/subscriptions/config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось сохранить')
        return
      }
      setConfig(data.config)
      toast.success('Подписка сохранена')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  function scrollToIndex(idx: number) {
    setActiveIndex(idx)
    const el = carouselRef.current?.children[idx] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  if (loading) {
    return (
      <main className="flex h-[100dvh] items-center justify-center">
        <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
      </main>
    )
  }

  if (!subscriptionEnabled) {
    return (
      <main className="flex h-[100dvh] flex-col px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[18px] font-extrabold tracking-tight">подписки</h1>
          <Link href="/admin" className="text-[12px] font-semibold text-[color:var(--muted)]">
            ← кабинет
          </Link>
        </header>
        <EmptyStatePlaceholder
          variant="subscription"
          message={
            <>
              Включите подписки в{' '}
              <Link href="/admin/venue" className="font-semibold underline">
                настройках заведения
              </Link>
              .
            </>
          }
        />
      </main>
    )
  }

  if (products.length === 0) {
    return (
      <main className="flex h-[100dvh] flex-col px-4 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-[18px] font-extrabold tracking-tight">подписки</h1>
          <Link href="/admin/store" className="text-[12px] font-semibold text-[color:var(--primary)]">
            → меню
          </Link>
        </header>
        <EmptyStatePlaceholder
          variant="menuEmpty"
          message="Нет позиций с отметкой «доступно для подписки». Отметьте блюда и опции в разделе меню."
        />
      </main>
    )
  }

  return (
    <main className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[color:var(--bg)]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--stroke)] px-4 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight">подписки</h1>
          <p className="text-[11px] font-medium text-[color:var(--muted)]">каталог · слоты · цена</p>
        </div>
        <Link
          href="/admin/subscriptions/clients"
          className="rounded-full bg-black/[0.05] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--muted)]"
        >
          клиенты
        </Link>
      </header>

      {/* ZONE 1 — Carousel */}
      <section className="shrink-0 border-b border-[color:var(--stroke)] py-3">
        <div
          ref={carouselRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((p, i) => {
            const active = i === activeIndex
            const noCost = p.costPrice == null || p.costPrice <= 0
            const pk = productKey(p)
            return (
              <button
                key={pk}
                type="button"
                onClick={() => scrollToIndex(i)}
                className={cn(
                  'relative flex w-[132px] shrink-0 snap-center flex-col rounded-2xl border p-3 text-left transition-all duration-200 ease-in-out',
                  active
                    ? 'scale-105 border-[color:var(--primary)] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
                    : 'scale-100 border-[color:var(--stroke)] bg-[color:var(--surface)] opacity-80'
                )}
              >
                <span className="text-[28px] leading-none">{p.emoji || (p.kind === 'dish' ? '🍽' : '🥄')}</span>
                <span className="mt-2 line-clamp-2 text-[13px] font-bold leading-tight">{p.name}</span>
                <span className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  {p.categoryName}
                </span>
                <span className="mt-2 text-[11px] tabular-nums text-black/45">
                  FC: {noCost ? '—' : formatPrice(p.costPrice)}
                </span>
                {noCost ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCostPopoverKey(pk)
                      setCostDraft('')
                    }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.06] text-[11px] font-bold text-black/40"
                  >
                    ?
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </section>

      {/* ZONE 2 — Configurator */}
      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeProduct ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-[20px] font-extrabold tracking-tight">{activeProduct.name}</h2>
              {activeProduct.kind === 'option' && activeProduct.parentDishName ? (
                <p className="text-[12px] text-[color:var(--muted)]">к блюду «{activeProduct.parentDishName}»</p>
              ) : null}
              <p className="mt-0.5 text-[13px] tabular-nums text-[color:var(--muted)]">
                витрина {formatPrice(activeProduct.price)}
              </p>
            </div>

            {/* Segmented slots */}
            <div className="flex rounded-full bg-black/[0.05] p-1">
              {MEAL_SLOT_IDS.map((slot) => {
                const assigned = isInSlot(activeProduct, slot)
                const selected = activeSlot === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setActiveSlot(slot)
                      assignToSlot(activeProduct, slot)
                    }}
                    className={cn(
                      'flex-1 rounded-full py-2.5 text-[12px] font-bold uppercase tracking-wide transition-all duration-200',
                      selected && assigned
                        ? 'bg-[color:var(--primary)] text-white shadow-sm'
                        : assigned
                          ? 'bg-white text-[color:var(--text)] shadow-sm'
                          : 'text-[color:var(--muted)]'
                    )}
                  >
                    {MEAL_SLOT_LABEL[slot]}
                  </button>
                )
              })}
            </div>

            {activeProduct.kind === 'dish' ? (
              <div className="flex items-center justify-between rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-3">
                <span className="text-[13px] font-semibold">порций за доставку</span>
                <InlineCounter
                  value={dishLimit(activeProduct, activeSlot)}
                  onDec={() => setDishLimit(activeProduct, activeSlot, dishLimit(activeProduct, activeSlot) - 1)}
                  onInc={() => setDishLimit(activeProduct, activeSlot, dishLimit(activeProduct, activeSlot) + 1)}
                  max={10}
                />
              </div>
            ) : (
              <p className="text-[12px] text-[color:var(--muted)]">
                Опция добавляется к блюдам в выбранном слоте.
              </p>
            )}

            <label className="block rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                себестоимость, ฿
              </span>
              <input
                type="number"
                min={0}
                value={activeProduct.costPrice ?? ''}
                placeholder="не задана"
                onChange={(e) => {
                  const v = e.target.value.trim()
                  const num = v === '' ? null : Math.max(0, Number(v) || 0)
                  setProducts((prev) =>
                    prev.map((x, i) => (i === activeIndex ? { ...x, costPrice: num } : x))
                  )
                }}
                onBlur={() => {
                  void saveCostPrice(activeProduct, activeProduct.costPrice)
                }}
                className="mt-1 w-full border-none bg-transparent p-0 text-[22px] font-bold tabular-nums outline-none"
              />
            </label>
          </div>
        ) : null}

        {costPopoverKey && activeProduct && productKey(activeProduct) === costPopoverKey ? (
          <div className="mt-3 rounded-2xl border border-[color:var(--stroke)] bg-white p-3 shadow-lg">
            <p className="text-[12px] font-semibold">быстрый ввод FC</p>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                autoFocus
                value={costDraft}
                onChange={(e) => setCostDraft(e.target.value)}
                placeholder="฿"
                className="input flex-1 rounded-xl px-3 py-2 text-[14px]"
              />
              <button
                type="button"
                className="btn btn-primary rounded-full px-4 text-[12px] font-semibold"
                onClick={() => {
                  const n = Number(costDraft)
                  if (!Number.isFinite(n) || n <= 0) return
                  void saveCostPrice(activeProduct, n)
                }}
              >
                ok
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ZONE 3 — Commerce */}
      <section className="shrink-0 border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 py-3">
        {quote ? (
          <div className="space-y-2 transition-all duration-200 ease-in-out">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                цена для гостя
              </p>
              <p className="text-[26px] font-extrabold tabular-nums tracking-tight">
                {formatPrice(weeklyGuestPrice)}
                <span className="ml-1 text-[14px] font-semibold text-[color:var(--muted)]">/ неделя</span>
              </p>
              {quote.guestSavingsPercent > 0 ? (
                <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  выгода клиента −{Math.round(quote.guestSavingsPercent)}% vs розница
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[color:var(--muted)]">
              <span>
                кэшфлоу: <strong className="text-[color:var(--text)]">+{formatPrice(weeklyGuestPrice)}</strong>
              </span>
              <span>
                макс. расход: <strong className="text-[color:var(--text)]">{formatPrice(worstPerDelivery)}</strong>/дост
              </span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                  твоя чистая прибыль
                </p>
                <p className="text-[18px] font-extrabold tabular-nums text-[color:var(--text)]">
                  {formatPrice(Math.round(quote.ownerMargin * (7 / (config.defaultPeriodDays || 7))))}
                </p>
              </div>
              {margin ? (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                    margin.tone === 'safe' && 'bg-emerald-100 text-emerald-800',
                    margin.tone === 'ok' && 'bg-blue-100 text-blue-800',
                    margin.tone === 'danger' && 'bg-red-100 text-red-800'
                  )}
                >
                  {margin.label}
                </span>
              ) : null}
            </div>

            <label className="block pt-1">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[color:var(--muted)]">
                <span>скидка абонемента</span>
                <span>{config.commerce.subscriptionDiscountPercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={config.commerce.subscriptionDiscountPercent}
                onChange={(e) =>
                  patchConfig({
                    ...config,
                    commerce: {
                      ...config.commerce,
                      subscriptionDiscountPercent: Number(e.target.value),
                    },
                  })
                }
                className="h-2 w-full accent-[color:var(--primary)]"
              />
            </label>

            {manualPriceOpen ? (
              <label className="block">
                <input
                  type="number"
                  value={config.ownerPriceOverride ?? ''}
                  placeholder={String(quote.recommendedPrice)}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    patchConfig({
                      ...config,
                      ownerPriceOverride: raw === '' ? null : Math.round(Number(raw) || 0),
                    })
                  }}
                  className={cn(
                    'input w-full rounded-xl px-3 py-2 text-[14px] font-semibold tabular-nums',
                    manualPriceInvalid && 'border-red-400 bg-red-50 text-red-700'
                  )}
                />
                {manualPriceInvalid ? (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">
                    ниже мин. маржи ({formatPrice(minAllowedPrice)})
                  </p>
                ) : null}
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setManualPriceOpen(true)}
                className="text-[12px] font-semibold text-[color:var(--primary)] underline-offset-2 hover:underline"
              >
                изменить цену вручную
              </button>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-[color:var(--muted)]">
            Назначьте блюда на слоты — появится расчёт цены.
          </p>
        )}
      </section>

      {/* ZONE 4 — FAB */}
      <footer className="shrink-0 border-t border-[color:var(--stroke)] bg-[color:var(--surface)] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveAll()}
          className="btn btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold disabled:opacity-50"
        >
          {saving ? 'сохраняем…' : '💾 сохранить изменения'}
        </button>
      </footer>
    </main>
  )
}
