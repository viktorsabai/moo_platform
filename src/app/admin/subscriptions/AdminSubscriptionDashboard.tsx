'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { MEAL_SLOT_IDS, MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import {
  defaultSubscriptionConfig,
  getEnabledMealSlots,
  type SubscriptionConfig,
} from '@/lib/subscription-config'
import { EmptyStatePlaceholder } from '@/components/ui/EmptyStatePlaceholder'
import { Chip } from '@/components/ui/Chip'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { AdminSubscriptionNav } from './AdminSubscriptionNav'

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

/** Пример одной доставки по активному слоту (default → первые блюда). */
function buildSlotQuoteItems(config: SubscriptionConfig, slot: MealSlot) {
  const sc = config.mealSlots[slot]
  if (!sc?.enabled || sc.dishIds.length === 0) return []

  const pick =
    sc.defaultDishIds.length > 0
      ? sc.defaultDishIds.filter((id) => sc.dishIds.includes(id)).slice(0, Math.max(1, sc.maxItemsPerDelivery))
      : sc.dishIds.slice(0, Math.max(1, sc.maxItemsPerDelivery))

  return pick.map((dishId) => ({
    dishId,
    quantity: 1,
    mealSlot: slot,
    modifierIds: [] as string[],
  }))
}

function countSlotItems(config: SubscriptionConfig, slot: MealSlot) {
  const sc = config.mealSlots[slot]
  return (sc?.dishIds.length ?? 0) + (sc?.optionIds?.length ?? 0)
}

export function AdminSubscriptionDashboard() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [config, setConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER)
  const [activeSlot, setActiveSlot] = useState<MealSlot>('lunch')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [quote, setQuote] = useState<QuotePreview | null>(null)
  const [commerceOpen, setCommerceOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)

  const filteredProducts = useMemo(() => {
    if (categoryFilter === ALL_FILTER) return products
    if (categoryFilter === OPTIONS_FILTER) return products.filter((p) => p.kind === 'option')
    return products.filter((p) => p.categoryId === categoryFilter)
  }, [products, categoryFilter])

  const selectedProduct = useMemo(
    () => products.find((p) => productKey(p) === selectedKey) ?? null,
    [products, selectedKey]
  )

  const slotConfig = config.mealSlots[activeSlot]
  const slotItemCount = countSlotItems(config, activeSlot)

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

  const activeCategoryLabel = useMemo(() => {
    if (categoryFilter === ALL_FILTER) return 'все позиции'
    if (categoryFilter === OPTIONS_FILTER) return 'опции'
    return categories.find((c) => c.id === categoryFilter)?.name ?? 'категория'
  }, [categoryFilter, categories])

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
    setSelectedKey(null)
  }, [categoryFilter, activeSlot])

  const previewItems = useMemo(() => buildSlotQuoteItems(config, activeSlot), [config, activeSlot])

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
            deliveryDays: 1,
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
  }, [previewItems, config.ownerPriceOverride, config.commerce])

  const perDeliveryGuest = quote ? Math.round(quote.guestPrice / Math.max(1, quote.deliveriesInPeriod)) : 0
  const perDeliveryRetail = quote ? Math.round(quote.perDeliveryRetail) : 0
  const perDeliveryProfit =
    quote && quote.perDeliveryCost > 0 ? Math.round(perDeliveryGuest - quote.perDeliveryCost) : null

  const minAllowedPeriodPrice = useMemo(() => {
    if (!quote || quote.perDeliveryCost <= 0) return 0
    return Math.round(
      quote.perDeliveryCost * (1 + config.commerce.minMarginPercent / 100) * Math.max(1, quote.deliveriesInPeriod)
    )
  }, [quote, config.commerce.minMarginPercent])

  const manualPriceInvalid =
    commerceOpen &&
    config.ownerPriceOverride != null &&
    config.ownerPriceOverride > 0 &&
    minAllowedPeriodPrice > 0 &&
    config.ownerPriceOverride < minAllowedPeriodPrice

  function patchConfig(next: SubscriptionConfig) {
    setConfig(next)
  }

  function patchSlot(slot: MealSlot, patch: Partial<SubscriptionConfig['mealSlots'][MealSlot]>) {
    setConfig((prev) => ({
      ...prev,
      mealSlots: { ...prev.mealSlots, [slot]: { ...prev.mealSlots[slot], ...patch } },
    }))
  }

  function isInSlot(p: CatalogProduct, slot: MealSlot = activeSlot) {
    const sc = config.mealSlots[slot]
    if (p.kind === 'dish') return sc.dishIds.includes(p.id)
    return (sc.optionIds ?? []).includes(p.id)
  }

  function isDefault(p: CatalogProduct, slot: MealSlot = activeSlot) {
    if (p.kind !== 'dish') return false
    return config.mealSlots[slot].defaultDishIds.includes(p.id)
  }

  function categoryLimitForFilter(): number | null {
    if (categoryFilter === ALL_FILTER || categoryFilter === OPTIONS_FILTER) return null
    return config.categoryLimits?.[categoryFilter] ?? null
  }

  function setCategoryLimitForFilter(value: number | null) {
    if (categoryFilter === ALL_FILTER || categoryFilter === OPTIONS_FILTER) return
    setConfig((prev) => {
      const limits = { ...(prev.categoryLimits ?? {}) }
      if (value == null || value <= 0) delete limits[categoryFilter]
      else limits[categoryFilter] = Math.max(1, Math.min(99, value))
      return { ...prev, categoryLimits: Object.keys(limits).length ? limits : undefined }
    })
  }

  function slotMaxLabel(max: number) {
    return max <= 0 ? 'безлимит' : String(max)
  }

  function toggleInSlot(p: CatalogProduct, slot: MealSlot = activeSlot) {
    setConfig((prev) => {
      const sc = prev.mealSlots[slot]
      if (p.kind === 'dish') {
        const has = sc.dishIds.includes(p.id)
        const dishIds = has ? sc.dishIds.filter((id) => id !== p.id) : [...sc.dishIds, p.id]
        return {
          ...prev,
          mealSlots: {
            ...prev.mealSlots,
            [slot]: {
              ...sc,
              enabled: true,
              dishIds,
              defaultDishIds: has ? sc.defaultDishIds.filter((id) => id !== p.id) : sc.defaultDishIds,
            },
          },
        }
      }
      const opts = sc.optionIds ?? []
      const has = opts.includes(p.id)
      return {
        ...prev,
        mealSlots: {
          ...prev.mealSlots,
          [slot]: {
            ...sc,
            enabled: true,
            optionIds: has ? opts.filter((id) => id !== p.id) : [...opts, p.id],
          },
        },
      }
    })
  }

  function toggleDefault(p: CatalogProduct, slot: MealSlot = activeSlot) {
    if (p.kind !== 'dish' || !isInSlot(p, slot)) return
    setConfig((prev) => {
      const sc = prev.mealSlots[slot]
      const has = sc.defaultDishIds.includes(p.id)
      const defaultDishIds = has
        ? sc.defaultDishIds.filter((id) => id !== p.id)
        : [...sc.defaultDishIds, p.id].slice(0, 3)
      return {
        ...prev,
        mealSlots: { ...prev.mealSlots, [slot]: { ...sc, defaultDishIds } },
      }
    })
  }

  function bulkToggleCategory(assign: boolean) {
    const targets =
      categoryFilter === ALL_FILTER
        ? filteredProducts
        : categoryFilter === OPTIONS_FILTER
          ? products.filter((p) => p.kind === 'option')
          : products.filter((p) => p.categoryId === categoryFilter)

    setConfig((prev) => {
      const sc = prev.mealSlots[activeSlot]
      let dishIds = [...sc.dishIds]
      let defaultDishIds = [...sc.defaultDishIds]
      let optionIds = [...(sc.optionIds ?? [])]

      for (const p of targets) {
        if (p.kind === 'dish') {
          if (assign) {
            if (!dishIds.includes(p.id)) dishIds.push(p.id)
          } else {
            dishIds = dishIds.filter((id) => id !== p.id)
            defaultDishIds = defaultDishIds.filter((id) => id !== p.id)
          }
        } else if (assign) {
          if (!optionIds.includes(p.id)) optionIds.push(p.id)
        } else {
          optionIds = optionIds.filter((id) => id !== p.id)
        }
      }

      return {
        ...prev,
        mealSlots: {
          ...prev.mealSlots,
          [activeSlot]: { ...sc, enabled: true, dishIds, defaultDishIds, optionIds },
        },
      }
    })
    toast.success(assign ? `Добавлено в ${MEAL_SLOT_LABEL[activeSlot]}` : 'Убрано из слота')
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
    <main className="ui-container ui-screen !pb-28 pt-1">
      <header className="mb-3 space-y-2">
        <AdminSubscriptionNav />
      </header>

      {/* Слот */}
      <section className="mb-3">
        <div className="flex rounded-full bg-black/[0.05] p-1">
          {MEAL_SLOT_IDS.map((slot) => {
            const count = countSlotItems(config, slot)
            const selected = activeSlot === slot
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={cn(
                  'relative flex-1 rounded-full py-2.5 text-[11px] font-bold uppercase tracking-wide transition-all duration-200',
                  selected ? 'bg-[color:var(--primary)] text-white shadow-sm' : 'text-[color:var(--muted)]'
                )}
              >
                {MEAL_SLOT_LABEL[slot]}
                {count > 0 ? (
                  <span
                    className={cn(
                      'ml-1 inline-flex min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold',
                      selected ? 'bg-white/25 text-white' : 'bg-black/10 text-[color:var(--text)]'
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setLimitsOpen((v) => !v)}
          className="mt-2 flex w-full items-center justify-between text-[12px] font-semibold text-[color:var(--muted)]"
        >
          <span>
            {slotItemCount === 0
              ? `Отметьте блюда для ${MEAL_SLOT_LABEL[activeSlot]}`
              : `${slotItemCount} поз. · лимит ${slotMaxLabel(slotConfig.maxItemsPerDelivery)}`}
          </span>
          <span>{limitsOpen ? '▲' : '▼'}</span>
        </button>
        {limitsOpen ? (
          <div className="mt-2 space-y-2 rounded-xl border border-[color:var(--stroke)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-[color:var(--muted)]">макс. в слоте</span>
              <button
                type="button"
                onClick={() => patchSlot(activeSlot, { maxItemsPerDelivery: 0, enabled: true })}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  slotConfig.maxItemsPerDelivery <= 0 ? 'bg-[color:var(--primary)] text-white' : 'bg-black/[0.06]'
                )}
              >
                безлимит
              </button>
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchSlot(activeSlot, { maxItemsPerDelivery: n, enabled: true })}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums',
                    slotConfig.maxItemsPerDelivery === n ? 'bg-[color:var(--primary)] text-white' : 'bg-black/[0.06]'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {categoryFilter !== ALL_FILTER && categoryFilter !== OPTIONS_FILTER ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--stroke)] pt-2">
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">лимит «{activeCategoryLabel}»</span>
                <button
                  type="button"
                  onClick={() => setCategoryLimitForFilter(null)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    categoryLimitForFilter() == null ? 'bg-[color:var(--primary)] text-white' : 'bg-black/[0.06]'
                  )}
                >
                  безлимит
                </button>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCategoryLimitForFilter(n)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums',
                      categoryLimitForFilter() === n ? 'bg-[color:var(--primary)] text-white' : 'bg-black/[0.06]'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Категория */}
      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">меню</p>
          {categoryFilter !== ALL_FILTER && filteredProducts.length > 0 ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => bulkToggleCategory(true)} className="text-[11px] font-semibold text-[color:var(--primary)]">
                все в слот
              </button>
              <button type="button" onClick={() => bulkToggleCategory(false)} className="text-[11px] font-semibold text-[color:var(--muted)]">
                снять
              </button>
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 px-0.5">
            {filterChips.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoryFilter(c.id)} className="shrink-0 transition active:scale-[0.98]">
                <Chip accent={categoryFilter === c.id} className="whitespace-nowrap px-3.5 py-2 text-[13px]">
                  {c.emoji ? <span className="mr-1.5 text-[1.2em] leading-none" aria-hidden>{c.emoji}</span> : null}
                  {c.name}
                </Chip>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Сетка блюд */}
      <section className="mb-4">
        {filteredProducts.length === 0 ? (
          <p className="ui-muted px-1 text-[13px]">В «{activeCategoryLabel}» нет позиций для подписки.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredProducts.map((p) => {
              const pk = productKey(p)
              const inSlot = isInSlot(p)
              const isDef = isDefault(p)
              const selected = selectedKey === pk
              const noCost = p.costPrice == null || p.costPrice <= 0

              return (
                <article
                  key={pk}
                  className={cn(
                    'overflow-hidden border bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] transition-all',
                    selected ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]/20' : 'border-[color:var(--stroke)]',
                    inSlot && !selected && 'border-[color:var(--primary)]/40'
                  )}
                  style={{ borderRadius: 'var(--radius-large)' }}
                >
                  <div className="relative h-52 w-full shrink-0 overflow-hidden bg-[color:var(--surface-strong)]">
                    {p.image ? (
                      <OptimizedImage
                        src={p.image}
                        alt=""
                        className="object-cover"
                        sizes={IMAGE_SIZES.menuGrid}
                        quality={76}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[40px]">{p.emoji || '🍽'}</div>
                    )}

                    <button
                      type="button"
                      aria-label={inSlot ? 'убрать из слота' : 'добавить в слот'}
                      onClick={() => toggleInSlot(p)}
                      className={cn(
                        'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[13px] font-bold shadow-sm transition',
                        inSlot
                          ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
                          : 'border-white/90 bg-black/35 text-white backdrop-blur-sm'
                      )}
                    >
                      {inSlot ? '✓' : '+'}
                    </button>

                    {p.kind === 'dish' && inSlot ? (
                      <button
                        type="button"
                        aria-label={isDef ? 'убрать из default' : 'сделать default'}
                        onClick={() => toggleDefault(p)}
                        className={cn(
                          'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-[14px] shadow-sm transition',
                          isDef ? 'bg-amber-400 text-amber-950' : 'bg-black/35 text-white backdrop-blur-sm'
                        )}
                      >
                        ★
                      </button>
                    ) : null}

                    {noCost ? (
                      <span className="absolute bottom-2 right-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-white">
                        нет себест.
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedKey(selected ? null : pk)}
                    className="w-full px-2.5 py-2 text-left"
                  >
                    <p className="line-clamp-2 text-[12px] font-bold leading-tight">{p.name}</p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--muted)]">
                      {p.kind === 'option' && p.parentDishName ? p.parentDishName : p.categoryName}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-1 text-[10px] tabular-nums">
                      <span className="font-semibold">{formatPrice(p.price)}</span>
                      <span className={cn('text-black/45', noCost && 'text-amber-700')}>
                        {noCost ? 'себест. —' : `себест. ${formatPrice(p.costPrice)}`}
                      </span>
                    </div>
                    {inSlot && p.kind === 'dish' && isDef ? (
                      <p className="mt-1 text-[10px] font-semibold text-[color:var(--primary)]">★ default</p>
                    ) : inSlot && p.kind === 'option' ? (
                      <p className="mt-1 text-[10px] font-semibold text-[color:var(--primary)]">в слоте</p>
                    ) : null}
                  </button>
                </article>
              )
            })}
          </div>
        )}

        {/* Детали выбранной позиции */}
        {selectedProduct ? (
          <div className="ui-surface mt-3 space-y-3 p-4" style={{ borderRadius: 'var(--radius-large)' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-extrabold tracking-tight">{selectedProduct.name}</h2>
                <p className="ui-muted text-[12px]">
                  витрина {formatPrice(selectedProduct.price)}
                  {selectedProduct.kind === 'option' && selectedProduct.parentDishName
                    ? ` · ${selectedProduct.parentDishName}`
                    : ''}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedKey(null)} className="ui-muted text-[12px] font-semibold">
                закрыть
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleInSlot(selectedProduct)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
                  isInSlot(selectedProduct)
                    ? 'bg-[color:var(--primary)] text-white'
                    : 'bg-black/[0.06] text-[color:var(--text)]'
                )}
              >
                {isInSlot(selectedProduct) ? `в ${MEAL_SLOT_LABEL[activeSlot]}` : `добавить в ${MEAL_SLOT_LABEL[activeSlot]}`}
              </button>
              {selectedProduct.kind === 'dish' && isInSlot(selectedProduct) ? (
              <button
                type="button"
                onClick={() => toggleDefault(selectedProduct)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
                  isDefault(selectedProduct) ? 'bg-amber-100 text-amber-900' : 'bg-black/[0.06] text-[color:var(--text)]'
                )}
              >
                {isDefault(selectedProduct) ? '★ default' : 'сделать default'}
              </button>
            ) : null}
            </div>

            <label className="block border-t border-[color:var(--stroke)] pt-3">
              <span className="text-[11px] font-semibold uppercase text-[color:var(--muted)]">себестоимость</span>
              <input
                type="number"
                min={0}
                value={selectedProduct.costPrice ?? ''}
                placeholder="не задана — маржа будет неточной"
                onChange={(e) => {
                  const v = e.target.value.trim()
                  const num = v === '' ? null : Math.max(0, Number(v) || 0)
                  setProducts((prev) =>
                    prev.map((x) => (productKey(x) === productKey(selectedProduct) ? { ...x, costPrice: num } : x))
                  )
                }}
                onBlur={() => void saveCostPrice(selectedProduct, selectedProduct.costPrice)}
                className="mt-1 w-full border-none bg-transparent p-0 text-[22px] font-bold tabular-nums outline-none"
              />
            </label>

            {selectedProduct.kind === 'dish' && isDefault(selectedProduct) ? (
              <p className="text-[11px] text-[color:var(--muted)]">
                Default — блюдо, которое гость увидит первым в рационе на {MEAL_SLOT_LABEL[activeSlot]}.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Цена — отдельный блок внизу, не перекрывает меню */}
      <section className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]">
        <button
          type="button"
          onClick={() => setCommerceOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <div>
            <p className="text-[13px] font-bold">цена и скидка</p>
            <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">
              {slotItemCount === 0
                ? 'сначала добавьте блюда в слот'
                : quote
                  ? `подписка ${formatPrice(perDeliveryGuest)} · розница ${formatPrice(perDeliveryRetail)} · −${config.commerce.subscriptionDiscountPercent}%`
                  : 'считаем…'}
            </p>
          </div>
          <span className="shrink-0 text-[12px] text-[color:var(--muted)]">{commerceOpen ? '▲' : '▼'}</span>
        </button>

        {commerceOpen ? (
          <div className="space-y-3 border-t border-[color:var(--stroke)] px-4 pb-4 pt-3">
            {slotItemCount > 0 && quote ? (
              <>
                <p className="text-[12px] text-[color:var(--muted)]">
                  Превью для default-блюда в {MEAL_SLOT_LABEL[activeSlot]}. Гость сам выберет количество и дни.
                </p>
                {perDeliveryProfit != null ? (
                  <p className="text-[12px]">
                    прибыль ~ <strong>{formatPrice(perDeliveryProfit)}</strong> за доставку
                    {quote.ownerMarginPercent > 0 ? ` · маржа ${Math.round(quote.ownerMarginPercent)}%` : ''}
                  </p>
                ) : (
                  <p className="text-[12px] text-amber-700">Заполните себестоимость у блюд — покажем маржу.</p>
                )}
              </>
            ) : null}

            <label className="block">
              <div className="mb-1 flex justify-between text-[12px] font-semibold">
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

            <label className="block">
              <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                фикс. цена за период ({config.defaultPeriodDays} дн.), опционально
              </span>
              <input
                type="number"
                value={config.ownerPriceOverride ?? ''}
                placeholder="авто"
                onChange={(e) => {
                  const raw = e.target.value.trim()
                  patchConfig({ ...config, ownerPriceOverride: raw === '' ? null : Math.round(Number(raw) || 0) })
                }}
                className={cn(
                  'input mt-1 w-full rounded-xl px-3 py-2 text-[14px] font-semibold tabular-nums',
                  manualPriceInvalid && 'border-red-400 bg-red-50'
                )}
              />
              {manualPriceInvalid ? (
                <p className="mt-1 text-[11px] text-red-600">мин. {formatPrice(minAllowedPeriodPrice)}</p>
              ) : null}
            </label>

            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <label>
                <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">мин. дней/нед</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={config.minDaysPerWeek}
                  onChange={(e) =>
                    patchConfig({
                      ...config,
                      minDaysPerWeek: Math.max(1, Math.min(7, Number(e.target.value) || 1)),
                    })
                  }
                  className="input mt-1 w-full rounded-lg px-2 py-1.5 text-[13px] font-semibold tabular-nums"
                />
              </label>
              <label>
                <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">макс. дней/нед</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={config.maxDaysPerWeek}
                  onChange={(e) =>
                    patchConfig({
                      ...config,
                      maxDaysPerWeek: Math.max(config.minDaysPerWeek, Math.min(7, Number(e.target.value) || 7)),
                    })
                  }
                  className="input mt-1 w-full rounded-lg px-2 py-1.5 text-[13px] font-semibold tabular-nums"
                />
              </label>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--stroke)] bg-[color:var(--surface)]/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="ui-container">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveAll()}
            className="btn btn-primary h-12 w-full rounded-full text-[15px] font-bold disabled:opacity-50"
          >
            {saving ? 'сохраняем…' : 'сохранить'}
          </button>
        </div>
      </footer>
    </main>
  )
}
