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
import { PillTabToggle } from '@/components/ui/PillTabToggle'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { AdminSubscriptionNav } from './AdminSubscriptionNav'

const ALL_FILTER = '__all__'

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

function productKey(p: CatalogProduct) {
  return `${p.kind}:${p.id}`
}

function countSlotDishes(config: SubscriptionConfig, slot: MealSlot) {
  return config.mealSlots[slot]?.dishIds.length ?? 0
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
  const [limitsOpen, setLimitsOpen] = useState(false)

  const dishes = useMemo(() => products.filter((p) => p.kind === 'dish'), [products])

  const filteredDishes = useMemo(() => {
    if (categoryFilter === ALL_FILTER) return dishes
    return dishes.filter((p) => p.categoryId === categoryFilter)
  }, [dishes, categoryFilter])

  const optionsByDishId = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>()
    for (const p of products) {
      if (p.kind !== 'option') continue
      const list = map.get(p.dishId) ?? []
      list.push(p)
      map.set(p.dishId, list)
    }
    return map
  }, [products])

  const slotDishCount = countSlotDishes(config, activeSlot)

  const slotTabs = useMemo(
    () =>
      MEAL_SLOT_IDS.map((slot) => {
        const n = countSlotDishes(config, slot)
        return { id: slot, label: n > 0 ? `${MEAL_SLOT_LABEL[slot]} · ${n}` : MEAL_SLOT_LABEL[slot] }
      }),
    [config]
  )

  const filterChips = useMemo(() => {
    const chips: { id: string; name: string; emoji?: string | null }[] = [{ id: ALL_FILTER, name: 'всё' }]
    for (const c of categories) {
      if (dishes.some((p) => p.categoryId === c.id)) {
        chips.push({ id: c.id, name: c.name, emoji: c.emoji })
      }
    }
    return chips
  }, [categories, dishes])

  const activeCategoryLabel = useMemo(() => {
    if (categoryFilter === ALL_FILTER) return 'все блюда'
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

  function isFirstPick(p: CatalogProduct, slot: MealSlot = activeSlot) {
    if (p.kind !== 'dish') return false
    return config.mealSlots[slot].defaultDishIds.includes(p.id)
  }

  function toggleDishInSlot(dish: CatalogProduct) {
    setConfig((prev) => {
      const sc = prev.mealSlots[activeSlot]
      const has = sc.dishIds.includes(dish.id)
      const dishIds = has ? sc.dishIds.filter((id) => id !== dish.id) : [...sc.dishIds, dish.id]
      let defaultDishIds = has ? sc.defaultDishIds.filter((id) => id !== dish.id) : [...sc.defaultDishIds]
      if (!has && defaultDishIds.length === 0) defaultDishIds = [dish.id]
      return {
        ...prev,
        mealSlots: {
          ...prev.mealSlots,
          [activeSlot]: { ...sc, enabled: true, dishIds, defaultDishIds },
        },
      }
    })
  }

  function toggleFirstPick(dish: CatalogProduct) {
    if (!isInSlot(dish)) return
    setConfig((prev) => {
      const sc = prev.mealSlots[activeSlot]
      const has = sc.defaultDishIds.includes(dish.id)
      const defaultDishIds = has
        ? sc.defaultDishIds.filter((id) => id !== dish.id)
        : [dish.id, ...sc.defaultDishIds.filter((id) => id !== dish.id)].slice(0, 3)
      return {
        ...prev,
        mealSlots: { ...prev.mealSlots, [activeSlot]: { ...sc, defaultDishIds } },
      }
    })
  }

  function toggleOptionInSlot(opt: CatalogProduct) {
    setConfig((prev) => {
      const sc = prev.mealSlots[activeSlot]
      const opts = sc.optionIds ?? []
      const has = opts.includes(opt.id)
      return {
        ...prev,
        mealSlots: {
          ...prev.mealSlots,
          [activeSlot]: {
            ...sc,
            enabled: true,
            optionIds: has ? opts.filter((id) => id !== opt.id) : [...opts, opt.id],
          },
        },
      }
    })
  }

  function bulkToggleCategory(assign: boolean) {
    const targets =
      categoryFilter === ALL_FILTER
        ? filteredDishes
        : dishes.filter((p) => p.categoryId === categoryFilter)

    setConfig((prev) => {
      const sc = prev.mealSlots[activeSlot]
      let dishIds = [...sc.dishIds]
      let defaultDishIds = [...sc.defaultDishIds]

      for (const p of targets) {
        if (assign) {
          if (!dishIds.includes(p.id)) dishIds.push(p.id)
        } else {
          dishIds = dishIds.filter((id) => id !== p.id)
          defaultDishIds = defaultDishIds.filter((id) => id !== p.id)
        }
      }
      if (assign && defaultDishIds.length === 0 && dishIds.length > 0) {
        defaultDishIds = [dishIds[0]]
      }

      return {
        ...prev,
        mealSlots: {
          ...prev.mealSlots,
          [activeSlot]: { ...sc, enabled: true, dishIds, defaultDishIds },
        },
      }
    })
    toast.success(assign ? `Добавлено в ${MEAL_SLOT_LABEL[activeSlot]}` : 'Убрано')
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

  if (dishes.length === 0) {
    return (
      <main className="ui-container ui-screen flex h-[100dvh] flex-col">
        <EmptyStatePlaceholder
          variant="menuEmpty"
          message="Отметьте блюда «доступно для подписки» в разделе меню."
        />
      </main>
    )
  }

  const slotConfig = config.mealSlots[activeSlot]

  return (
    <main className="ui-container ui-screen !pb-28 pt-1">
      <header className="mb-3">
        <AdminSubscriptionNav />
      </header>

      <section className="mb-3">
        <PillTabToggle className="w-full" options={slotTabs} value={activeSlot} onChange={(v) => setActiveSlot(v as MealSlot)} />
        <p className="ui-muted mt-2 text-[12px]">
          {slotDishCount === 0
            ? `Нажмите на блюдо — добавить в ${MEAL_SLOT_LABEL[activeSlot]}`
            : `${slotDishCount} блюд · скидка −${config.commerce.subscriptionDiscountPercent}%`}
        </p>
      </section>

      <section className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          {categoryFilter !== ALL_FILTER && filteredDishes.length > 0 ? (
            <div className="flex gap-3">
              <button type="button" onClick={() => bulkToggleCategory(true)} className="text-[12px] font-semibold text-[color:var(--primary)]">
                все
              </button>
              <button type="button" onClick={() => bulkToggleCategory(false)} className="text-[12px] font-semibold text-[color:var(--muted)]">
                снять
              </button>
            </div>
          ) : (
            <span />
          )}
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

      <section className="mb-5">
        {filteredDishes.length === 0 ? (
          <p className="ui-muted text-[13px]">В «{activeCategoryLabel}» нет блюд для подписки.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredDishes.map((dish) => {
              const inSlot = isInSlot(dish)
              const firstPick = isFirstPick(dish)
              const dishOptions = optionsByDishId.get(dish.id) ?? []

              return (
                <article
                  key={dish.id}
                  className={cn(
                    'overflow-hidden border bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)] transition-all',
                    inSlot ? 'border-[color:var(--primary)]' : 'border-[color:var(--stroke)]'
                  )}
                  style={{ borderRadius: 'var(--radius-large)' }}
                >
                  <button type="button" onClick={() => toggleDishInSlot(dish)} className="block w-full text-left">
                    <div className="relative h-48 w-full shrink-0 overflow-hidden bg-[color:var(--surface-strong)]">
                      {dish.image ? (
                        <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.menuGrid} quality={76} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[40px]">{dish.emoji || '🍽'}</div>
                      )}
                      <span
                        className={cn(
                          'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold shadow-sm',
                          inSlot ? 'bg-[color:var(--primary)] text-white' : 'bg-black/40 text-white backdrop-blur-sm'
                        )}
                      >
                        {inSlot ? '✓' : '+'}
                      </span>
                      {inSlot && firstPick ? (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-bold text-amber-950">
                          первым
                        </span>
                      ) : null}
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="line-clamp-2 text-[12px] font-bold leading-tight">{dish.name}</p>
                      <p className="mt-1 text-[12px] font-semibold tabular-nums">{formatPrice(dish.price)}</p>
                    </div>
                  </button>

                  {inSlot ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-[color:var(--stroke)] px-2 pb-2 pt-1.5">
                      {!firstPick ? (
                        <button
                          type="button"
                          onClick={() => toggleFirstPick(dish)}
                          className="rounded-full bg-black/[0.06] px-2 py-1 text-[10px] font-semibold"
                        >
                          показать первым
                        </button>
                      ) : null}
                      {dishOptions.map((opt) => {
                        const optOn = isInSlot(opt)
                        return (
                          <button
                            key={productKey(opt)}
                            type="button"
                            onClick={() => toggleOptionInSlot(opt)}
                            className={cn(
                              'rounded-full px-2 py-1 text-[10px] font-semibold',
                              optOn ? 'bg-[color:var(--primary)] text-white' : 'bg-black/[0.06]'
                            )}
                          >
                            {opt.name}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
        <label className="block">
          <div className="mb-2 flex justify-between text-[13px] font-semibold">
            <span>скидка абонемента</span>
            <span className="tabular-nums">−{config.commerce.subscriptionDiscountPercent}%</span>
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
        <p className="ui-muted mt-2 text-[12px] leading-snug">
          Цена у каждого гостя своя — из его рациона и дней доставки, минус эта скидка.
        </p>

        <button
          type="button"
          onClick={() => setLimitsOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between text-[12px] font-semibold text-[color:var(--muted)]"
        >
          <span>лимиты (редко нужны)</span>
          <span>{limitsOpen ? '▲' : '▼'}</span>
        </button>
        {limitsOpen ? (
          <div className="mt-2 space-y-3 border-t border-[color:var(--stroke)] pt-3">
            <div className="flex flex-wrap gap-2">
              <span className="w-full text-[11px] font-semibold text-[color:var(--muted)]">макс. блюд за одну доставку</span>
              {([0, 3, 5, 10] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchSlot(activeSlot, { maxItemsPerDelivery: n, enabled: true })}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-semibold',
                    slotConfig.maxItemsPerDelivery === n ? 'bg-[color:var(--primary)] text-white' : 'bg-black/[0.06]'
                  )}
                >
                  {n === 0 ? 'безлимит' : n}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
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
