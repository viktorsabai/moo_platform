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
import { PillTabToggle } from '@/components/ui/PillTabToggle'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { AdminSubscriptionNav } from './AdminSubscriptionNav'
import { AdminSubscriptionDishPickerSheet } from './AdminSubscriptionDishPickerSheet'
import { AdminSubscriptionPricingSimple } from './AdminSubscriptionPricingSimple'

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
  const [savedConfigJson, setSavedConfigJson] = useState('')
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [activeSlot, setActiveSlot] = useState<MealSlot>('lunch')
  const [pickerOpen, setPickerOpen] = useState(false)

  const dishes = useMemo(() => products.filter((p) => p.kind === 'dish'), [products])

  const slotSelectedDishes = useMemo(() => {
    const ids = config.mealSlots[activeSlot]?.dishIds ?? []
    return ids
      .map((id) => dishes.find((d) => d.id === id))
      .filter((d): d is CatalogProduct => Boolean(d))
  }, [config, activeSlot, dishes])

  const slotSelectedIdSet = useMemo(
    () => new Set(config.mealSlots[activeSlot]?.dishIds ?? []),
    [config, activeSlot]
  )

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

  const exampleDish = useMemo(() => {
    const sc = config.mealSlots[activeSlot]
    const pickId =
      sc.defaultDishIds.find((id) => sc.dishIds.includes(id)) ?? sc.dishIds[0] ?? null
    if (!pickId) return null
    return dishes.find((d) => d.id === pickId) ?? null
  }, [config, activeSlot, dishes])

  const missingCostInSlot = useMemo(() => {
    const ids = config.mealSlots[activeSlot].dishIds
    return ids.filter((id) => {
      const d = dishes.find((x) => x.id === id)
      return !d || d.costPrice == null || d.costPrice <= 0
    }).length
  }, [config, activeSlot, dishes])

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
        const loaded = cfgData.config ?? defaultSubscriptionConfig()
        setConfig(loaded)
        setSavedConfigJson(JSON.stringify(loaded))
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
      setSavedConfigJson(JSON.stringify(data.config))
      toast.success('Каталог сохранён — гости увидят блюда в подписке')
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  const isDirty = useMemo(() => JSON.stringify(config) !== savedConfigJson, [config, savedConfigJson])

  const totalCatalogDishes = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of MEAL_SLOT_IDS) {
      for (const id of config.mealSlots[slot]?.dishIds ?? []) ids.add(id)
    }
    return ids.size
  }, [config])

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

  return (
    <main className="ui-container ui-screen pb-[calc(100px+env(safe-area-inset-bottom))] pt-1">
      <header className="mb-3">
        <Link
          href="/profile"
          className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--muted)]"
        >
          ← профиль
        </Link>
        <AdminSubscriptionNav />
        {isDirty ? (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-900">
            {totalCatalogDishes} блюд · {slotDishCount} в {MEAL_SLOT_LABEL[activeSlot]} · не сохранено
          </p>
        ) : totalCatalogDishes > 0 ? (
          <p className="ui-muted mt-2 text-[12px]">
            {totalCatalogDishes} блюд в каталоге · гости видят сохранённый набор
          </p>
        ) : (
          <p className="ui-muted mt-2 text-[12px]">Добавьте блюда и нажмите «сохранить» внизу</p>
        )}
      </header>

      <section className="mb-3">
        <PillTabToggle className="w-full" options={slotTabs} value={activeSlot} onChange={(v) => setActiveSlot(v as MealSlot)} />
        <p className="ui-muted mt-2 text-[12px]">
          {slotDishCount === 0
            ? `Добавьте блюда в ${MEAL_SLOT_LABEL[activeSlot]} — гость увидит только их`
            : `${slotDishCount} в каталоге · базовая скидка −${config.commerce.subscriptionDiscountPercent}%`}
        </p>
      </section>

      <section className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold">в подписке · {MEAL_SLOT_LABEL[activeSlot]}</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-[12px] font-semibold text-[color:var(--primary)]"
          >
            + добавить
          </button>
        </div>

        {slotSelectedDishes.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full flex-col items-center rounded-[var(--radius-medium)] border border-dashed border-[color:var(--stroke)] py-8 text-[13px] font-semibold text-[color:var(--muted)]"
          >
            <span className="text-[28px] font-light leading-none">+</span>
            <span className="mt-2">выбрать блюда</span>
          </button>
        ) : (
          <ul className="space-y-2">
            {slotSelectedDishes.map((dish) => {
              const firstPick = isFirstPick(dish)
              const dishOptions = optionsByDishId.get(dish.id) ?? []
              return (
                <li
                  key={dish.id}
                  className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
                      {dish.image ? (
                        <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[20px]">{dish.emoji || '🍽'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{dish.name}</p>
                      <p className="text-[11px] tabular-nums text-[color:var(--muted)]">{formatPrice(dish.price)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDishInSlot(dish)}
                      className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-[color:var(--muted)]"
                    >
                      убрать
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {firstPick ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">первым у гостя</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleFirstPick(dish)}
                        className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold"
                      >
                        показать первым
                      </button>
                    )}
                    {dishOptions.map((opt) => {
                      const optOn = isInSlot(opt)
                      return (
                        <button
                          key={productKey(opt)}
                          type="button"
                          onClick={() => toggleOptionInSlot(opt)}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            optOn ? 'bg-[color:var(--primary)] text-white' : 'bg-black/[0.06]'
                          )}
                        >
                          {opt.name}
                        </button>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <AdminSubscriptionDishPickerSheet
        open={pickerOpen}
        slot={activeSlot}
        dishes={dishes}
        categories={categories}
        selectedIds={slotSelectedIdSet}
        onClose={() => setPickerOpen(false)}
        onToggle={toggleDishInSlot}
      />

      <AdminSubscriptionPricingSimple
        config={config}
        exampleDish={exampleDish}
        missingCostCount={missingCostInSlot}
        onPatchConfig={patchConfig}
      />

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-[110] border-t backdrop-blur-md',
          isDirty ? 'border-amber-300 bg-amber-50/98' : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/98'
        )}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="ui-container space-y-2 px-4 py-3">
          {isDirty ? (
            <p className="text-center text-[11px] font-semibold text-amber-900">
              готово? сохраните каталог — гости увидят изменения
            </p>
          ) : null}
          <button
            type="button"
            disabled={saving || !isDirty}
            onClick={() => void saveAll()}
            className="btn btn-primary h-12 w-full rounded-full text-[16px] font-bold disabled:opacity-50"
          >
            {saving ? 'сохраняем…' : isDirty ? 'сохранить каталог' : 'каталог сохранён'}
          </button>
        </div>
      </div>
    </main>
  )
}
