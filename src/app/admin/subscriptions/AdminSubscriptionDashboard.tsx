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
import { Chip } from '@/components/ui/Chip'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

const ALL_FILTER = '__all__'
const OPTIONS_FILTER = '__options__'

export type CatalogProduct = {
  kind: 'dish' | 'option'
  id: string
  name: string
  emoji?: string | null
  categoryId: string
  categoryName: string
  price: number
  costPrice: number | null
  image?: string | null
  dishId: string
  parentDishName?: string | null
}

type MenuCategory = { id: string; name: string; slug: string; emoji?: string | null }

type QuotePreview = {
  guestPrice: number
  periodRetail: number
  guestSavingsPercent: number
  ownerMargin: number
  ownerMarginPercent: number
  recommendedPrice: number
  perDeliveryRetail: number
  perDeliveryCost: number
  deliveriesInPeriod: number
  missingCostCount: number
}

function productKey(p: CatalogProduct) {
  return `${p.kind}:${p.id}`
}

/** Только явно назначенные на слоты блюда — без «все eligible». */
function buildQuoteItems(config: SubscriptionConfig) {
  const items: { dishId: string; quantity: number; mealSlot: MealSlot; modifierIds: string[] }[] = []
  for (const slot of MEAL_SLOT_IDS) {
    const sc = config.mealSlots[slot]
    if (!sc?.enabled || sc.dishIds.length === 0) continue
    for (const dishId of sc.dishIds) {
      const limit = Math.max(1, sc.dishLimits?.[dishId] ?? 1)
      items.push({ dishId, quantity: limit, mealSlot: slot, modifierIds: [] })
    }
  }
  return items
}

function countAssignedDishes(config: SubscriptionConfig) {
  const ids = new Set<string>()
  for (const slot of MEAL_SLOT_IDS) {
    const sc = config.mealSlots[slot]
    if (!sc?.enabled) continue
    sc.dishIds.forEach((id) => ids.add(id))
  }
  return ids.size
}

export function AdminSubscriptionDashboard() {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [config, setConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER)
  const [activeIndex, setActiveIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<MealSlot>('lunch')
  const [quote, setQuote] = useState<QuotePreview | null>(null)
  const [manualPriceOpen, setManualPriceOpen] = useState(false)
  const [costPopoverKey, setCostPopoverKey] = useState<string | null>(null)
  const [costDraft, setCostDraft] = useState('')

  const filteredProducts = useMemo(() => {
    if (categoryFilter === ALL_FILTER) return products
    if (categoryFilter === OPTIONS_FILTER) return products.filter((p) => p.kind === 'option')
    return products.filter((p) => p.categoryId === categoryFilter)
  }, [products, categoryFilter])

  const activeProduct = filteredProducts[activeIndex] ?? null
  const assignedCount = useMemo(() => countAssignedDishes(config), [config])

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
        setCategories(Array.isArray(cfgData.categories) ? cfgData.categories : [])
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

  useEffect(() => {
    setActiveIndex(0)
  }, [categoryFilter])

  const previewItems = useMemo(() => buildQuoteItems(config), [config])

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

  const weeklyDeliveries = config.minDaysPerWeek
  const perDeliveryGuest = quote ? Math.round(quote.guestPrice / Math.max(1, quote.deliveriesInPeriod)) : 0
  const perDeliveryRetail = quote ? Math.round(quote.perDeliveryRetail) : 0
  const weeklyGuest = quote ? Math.round(perDeliveryGuest * weeklyDeliveries) : 0
  const weeklyRetail = quote ? Math.round(perDeliveryRetail * weeklyDeliveries) : 0
  const weeklyProfit = quote && quote.perDeliveryCost > 0
    ? Math.round((perDeliveryGuest - quote.perDeliveryCost) * weeklyDeliveries)
    : null

  const minAllowedPrice = useMemo(() => {
    if (!quote || quote.perDeliveryCost <= 0) return 0
    return Math.round(quote.perDeliveryCost * (1 + config.commerce.minMarginPercent / 100) * weeklyDeliveries)
  }, [quote, config.commerce.minMarginPercent, weeklyDeliveries])

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

  function isInAnySlot(p: CatalogProduct) {
    return MEAL_SLOT_IDS.some((s) => isInSlot(p, s))
  }

  function dishLimit(p: CatalogProduct, slot: MealSlot) {
    if (p.kind !== 'dish') return 1
    return config.mealSlots[slot].dishLimits?.[p.id] ?? 1
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
            dishLimits: Object.fromEntries(Object.entries(sc.dishLimits ?? {}).filter(([id]) => id !== p.id)),
          }
        } else {
          mealSlots[s] = { ...sc, optionIds: (sc.optionIds ?? []).filter((id) => id !== p.id) }
        }
      }
      const sc = mealSlots[slot]
      if (p.kind === 'dish') {
        const has = sc.dishIds.includes(p.id)
        const dishIds = has ? sc.dishIds.filter((id) => id !== p.id) : [...sc.dishIds, p.id]
        const dishLimits = { ...(sc.dishLimits ?? {}) }
        if (!has) dishLimits[p.id] = dishLimits[p.id] ?? 1
        else delete dishLimits[p.id]
        mealSlots[slot] = {
          ...sc,
          enabled: true,
          dishIds,
          dishLimits,
          defaultDishIds: has ? sc.defaultDishIds.filter((id) => id !== p.id) : [...sc.defaultDishIds, p.id].slice(0, 3),
        }
      } else {
        const opts = sc.optionIds ?? []
        const has = opts.includes(p.id)
        mealSlots[slot] = { ...sc, enabled: true, optionIds: has ? opts.filter((id) => id !== p.id) : [...opts, p.id] }
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
      dishIds: config.mealSlots[slot].dishIds.includes(p.id) ? config.mealSlots[slot].dishIds : [...config.mealSlots[slot].dishIds, p.id],
    })
  }

  async function saveCostPrice(p: CatalogProduct, value: number | null) {
    try {
      const res = await fetch('/api/admin/subscriptions/product-cost', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: p.kind, id: p.id, dishId: p.dishId, costPrice: value }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не сохранено')
        return
      }
      setProducts((prev) =>
        prev.map((x) => (productKey(x) === productKey(p) ? { ...x, costPrice: data.costPrice ?? value } : x))
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
      toast.success('Сохранено')
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

  const filterChips = useMemo(() => {
    const chips: { id: string; name: string; emoji?: string | null }[] = [{ id: ALL_FILTER, name: 'всё' }]
    for (const c of categories) {
      if (products.some((p) => p.kind === 'dish' && p.categoryId === c.id)) {
        chips.push({ id: c.id, name: c.name, emoji: c.emoji })
      }
    }
    if (products.some((p) => p.kind === 'option')) {
      chips.push({ id: OPTIONS_FILTER, name: 'опции', emoji: '🥄' })
    }
    return chips
  }, [categories, products])

  if (loading) {
    return (
      <main className="ui-container flex h-[100dvh] items-center justify-center">
        <p className="ui-muted text-[13px]">загрузка…</p>
      </main>
    )
  }

  if (!subscriptionEnabled) {
    return (
      <main className="ui-container ui-screen flex h-[100dvh] flex-col">
        <EmptyStatePlaceholder
          variant="subscription"
          message={
            <>
              Включите подписки в{' '}
              <Link href="/admin/venue" className="font-semibold underline">настройках заведения</Link>.
            </>
          }
        />
      </main>
    )
  }

  if (products.length === 0) {
    return (
      <main className="ui-container ui-screen flex h-[100dvh] flex-col">
        <EmptyStatePlaceholder
          variant="menuEmpty"
          message="Отметьте блюда «доступно для подписки» в разделе меню."
        />
      </main>
    )
  }

  return (
    <main className="ui-container flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between py-3">
        <div>
          <h1 className="ui-h1 text-[20px]">подписки</h1>
          <p className="ui-muted text-[12px]">{assignedCount} блюд в слотах</p>
        </div>
        <Link href="/admin/subscriptions/clients" className="ui-pill px-3 py-2 text-[12px] font-semibold">
          клиенты
        </Link>
      </header>

      {/* Category chips — как в меню */}
      <div className="shrink-0 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 px-0.5">
          {filterChips.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategoryFilter(c.id)} className="shrink-0 transition active:scale-[0.98]">
              <Chip accent={categoryFilter === c.id} className="whitespace-nowrap py-2 px-3.5 text-[13px]">
                {c.emoji ? <span className="mr-1.5 text-[1.2em] leading-none" aria-hidden>{c.emoji}</span> : null}
                {c.name}
              </Chip>
            </button>
          ))}
        </div>
      </div>

      {/* Carousel with photos */}
      <section className="shrink-0 py-2">
        {filteredProducts.length === 0 ? (
          <p className="ui-muted px-1 text-[13px]">В этой категории пусто.</p>
        ) : (
          <div
            ref={carouselRef}
            className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filteredProducts.map((p, i) => {
              const active = i === activeIndex
              const noCost = p.costPrice == null || p.costPrice <= 0
              const pk = productKey(p)
              const inSlot = isInAnySlot(p)
              return (
                <button
                  key={pk}
                  type="button"
                  onClick={() => scrollToIndex(i)}
                  className={cn(
                    'relative w-[108px] shrink-0 snap-center overflow-hidden text-left transition-all duration-200',
                    'border bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]',
                    active ? 'scale-[1.03] border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]/25' : 'border-[color:var(--stroke)] opacity-90'
                  )}
                  style={{ borderRadius: 'var(--radius-large)' }}
                >
                  <div className="relative h-[88px] w-full overflow-hidden bg-black/[0.04]">
                    {p.image ? (
                      <OptimizedImage src={p.image} alt="" className="object-cover" sizes={IMAGE_SIZES.productCardCompact} quality={78} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[32px]">{p.emoji || '🍽'}</div>
                    )}
                    {inSlot ? (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-[color:var(--primary)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                        в слоте
                      </span>
                    ) : null}
                    {noCost ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCostPopoverKey(pk)
                          setCostDraft('')
                          setActiveIndex(i)
                        }}
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-[10px] font-bold text-white"
                      >
                        ?
                      </span>
                    ) : null}
                  </div>
                  <div className="px-2 py-2">
                    <p className="line-clamp-2 text-[11px] font-bold leading-tight">{p.name}</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--muted)]">{p.categoryName}</p>
                    <p className="mt-1 text-[10px] tabular-nums text-black/45">
                      FC {noCost ? '—' : formatPrice(p.costPrice)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Configurator */}
      <section className="min-h-0 flex-1 overflow-y-auto py-2">
        {activeProduct ? (
          <div className="ui-surface space-y-3 p-4" style={{ borderRadius: 'var(--radius-large)' }}>
            <div>
              <h2 className="text-[17px] font-extrabold tracking-tight">{activeProduct.name}</h2>
              <p className="ui-muted text-[12px]">
                витрина {formatPrice(activeProduct.price)}
                {activeProduct.kind === 'option' && activeProduct.parentDishName ? ` · ${activeProduct.parentDishName}` : ''}
              </p>
            </div>

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
                      'flex-1 rounded-full py-2 text-[11px] font-bold uppercase tracking-wide transition-all duration-200',
                      selected && assigned
                        ? 'bg-[color:var(--primary)] text-white'
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
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">порций / доставку</span>
                <InlineCounter
                  value={dishLimit(activeProduct, activeSlot)}
                  onDec={() => setDishLimit(activeProduct, activeSlot, dishLimit(activeProduct, activeSlot) - 1)}
                  onInc={() => setDishLimit(activeProduct, activeSlot, dishLimit(activeProduct, activeSlot) + 1)}
                  max={10}
                />
              </div>
            ) : (
              <p className="ui-muted text-[12px]">Тап по слоту — добавить опцию к рациону.</p>
            )}

            <label className="block border-t border-[color:var(--stroke)] pt-3">
              <span className="text-[11px] font-semibold uppercase text-[color:var(--muted)]">себестоимость</span>
              <input
                type="number"
                min={0}
                value={activeProduct.costPrice ?? ''}
                placeholder="не задана"
                onChange={(e) => {
                  const v = e.target.value.trim()
                  const num = v === '' ? null : Math.max(0, Number(v) || 0)
                  setProducts((prev) =>
                    prev.map((x) => (productKey(x) === productKey(activeProduct) ? { ...x, costPrice: num } : x))
                  )
                }}
                onBlur={() => void saveCostPrice(activeProduct, activeProduct.costPrice)}
                className="mt-1 w-full border-none bg-transparent p-0 text-[20px] font-bold tabular-nums outline-none"
              />
            </label>
          </div>
        ) : null}

        {costPopoverKey && activeProduct && productKey(activeProduct) === costPopoverKey ? (
          <div className="ui-surface mt-2 p-3" style={{ borderRadius: 'var(--radius-large)' }}>
            <p className="text-[12px] font-semibold">FC для «{activeProduct.name}»</p>
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

      {/* Commerce — понятная раскладка */}
      <section className="ui-surface-strong shrink-0 border-t border-[color:var(--stroke)] p-4" style={{ borderRadius: 'var(--radius-large) var(--radius-large) 0 0' }}>
        {assignedCount === 0 ? (
          <p className="ui-muted text-[13px]">
            Выберите блюда и нажмите слот <strong>завтрак / обед / ужин</strong> — тогда посчитаем цену.
          </p>
        ) : quote ? (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              типовой рацион · {weeklyDeliveries} дн/нед
            </p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-xl bg-black/[0.03] p-2.5">
                <div className="text-[color:var(--muted)]">1 доставка розница</div>
                <div className="font-bold tabular-nums">{formatPrice(perDeliveryRetail)}</div>
              </div>
              <div className="rounded-xl bg-black/[0.03] p-2.5">
                <div className="text-[color:var(--muted)]">1 доставка подписка</div>
                <div className="font-bold tabular-nums text-[color:var(--primary)]">{formatPrice(perDeliveryGuest)}</div>
              </div>
            </div>
            <div>
              <div className="text-[22px] font-extrabold tabular-nums tracking-tight">
                {formatPrice(weeklyGuest)}
                <span className="ml-1 text-[13px] font-semibold text-[color:var(--muted)]">/ нед</span>
              </div>
              {weeklyRetail > weeklyGuest ? (
                <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  −{Math.round(((weeklyRetail - weeklyGuest) / weeklyRetail) * 100)}% vs {formatPrice(weeklyRetail)} розница
                </span>
              ) : null}
            </div>
            {weeklyProfit != null ? (
              <p className="text-[12px] text-[color:var(--muted)]">
                прибыль ~ <strong className="text-[color:var(--text)]">{formatPrice(weeklyProfit)}</strong>/нед
                {quote.ownerMarginPercent > 0 ? ` · маржа ${Math.round(quote.ownerMarginPercent)}%` : ''}
              </p>
            ) : (
              <p className="text-[12px] text-amber-700">
                Заполните FC у блюд — покажем точную маржу
                {quote.missingCostCount > 0 ? ` (${quote.missingCostCount} без себест.)` : ''}.
              </p>
            )}

            <label className="block">
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-[color:var(--muted)]">
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
                    commerce: { ...config.commerce, subscriptionDiscountPercent: Number(e.target.value) },
                  })
                }
                className="h-1.5 w-full accent-[color:var(--primary)]"
              />
            </label>

            {manualPriceOpen ? (
              <label className="block">
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">цена за 7 дней, ฿</span>
                <input
                  type="number"
                  value={config.ownerPriceOverride ?? ''}
                  placeholder={String(quote.recommendedPrice)}
                  onChange={(e) => {
                    const raw = e.target.value.trim()
                    patchConfig({ ...config, ownerPriceOverride: raw === '' ? null : Math.round(Number(raw) || 0) })
                  }}
                  className={cn('input mt-1 w-full rounded-xl px-3 py-2 text-[14px] font-semibold tabular-nums', manualPriceInvalid && 'border-red-400 bg-red-50')}
                />
                {manualPriceInvalid ? (
                  <p className="mt-1 text-[11px] text-red-600">мин. {formatPrice(minAllowedPrice)}</p>
                ) : null}
              </label>
            ) : (
              <button type="button" onClick={() => setManualPriceOpen(true)} className="text-[12px] font-semibold text-[color:var(--primary)]">
                своя цена
              </button>
            )}
          </div>
        ) : (
          <p className="ui-muted text-[13px]">считаем…</p>
        )}
      </section>

      <footer className="shrink-0 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveAll()}
          className="btn btn-primary h-12 w-full rounded-full text-[15px] font-bold disabled:opacity-50"
        >
          {saving ? 'сохраняем…' : 'сохранить'}
        </button>
      </footer>
    </main>
  )
}
