'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Dish, SubscriptionPlan, SubscriptionStatus } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import {
  defaultSubscriptionConfig,
  getEnabledMealSlots,
  getPeriodDiscountPercent,
  periodLabel,
  type SubscriptionConfig,
} from '@/lib/subscription-config'
import { buildPrefillItems, suggestDeliveryDays } from '@/lib/subscription-prefill'
import { MEAL_SLOT_LABEL, type MealSlot, parseMealSlot } from '@/lib/subscription-meal-slots'
import { useSubscriptionStore } from '@/store/subscription-store'

type MenuCategory = { id: string; name: string; slug: string; emoji?: string | null }
type SelectedLine = { dishId: string; quantity: number; mealSlot: MealSlot | null; modifierIds: string[] }

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const STEPS = ['период', 'рацион', 'оформление'] as const

function wizardDayToJs(d: number) {
  return d === 6 ? 0 : d + 1
}

function mapDish(d: any): Dish {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? undefined,
    price: Number(d.price ?? 0),
    costPrice: d.costPrice == null ? null : Number(d.costPrice),
    image: d.image ?? '',
    categoryId: d.categoryId ?? d.category?.id ?? 'uncat',
    isAvailable: d.isAvailable !== false,
    tags: d.tags ?? [],
    calories: d.calories ?? undefined,
    optionGroups: Array.isArray(d.optionGroups) ? d.optionGroups : [],
    modifiers: Array.isArray(d.modifiers) ? d.modifiers : [],
  }
}

function lineKey(item: SelectedLine) {
  return `${item.dishId}:${item.mealSlot ?? 'any'}`
}

export function SubscriptionCheckoutFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume') || ''
  const addSubscription = useSubscriptionStore((s) => s.addSubscription)

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [subConfig, setSubConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [dishes, setDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2])
  const [periodDays, setPeriodDays] = useState(28)
  const [personCount, setPersonCount] = useState(1)
  const [lines, setLines] = useState<SelectedLine[]>([])
  const [name, setName] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activeSlot, setActiveSlot] = useState<MealSlot | 'all'>('all')
  const [liveQuote, setLiveQuote] = useState<{ guestPrice: number; deliveriesInPeriod: number } | null>(null)
  const createRequestIdRef = useRef<string | null>(null)

  const enabledSlots = useMemo(() => getEnabledMealSlots(subConfig), [subConfig])
  const minDays = subConfig.minDaysPerWeek
  const maxDays = subConfig.maxDaysPerWeek

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [cfgRes, dishRes] = await Promise.all([
          fetch('/api/subscriptions/config', { cache: 'no-store', credentials: 'include', headers: { ...telegramInitHeaderRecord() } }),
          fetch('/api/dishes?subscriptionEligible=true', { cache: 'no-store', credentials: 'include', headers: { ...telegramInitHeaderRecord() } }),
        ])
        const cfgData = await cfgRes.json().catch(() => null)
        const dishData = await dishRes.json().catch(() => null)
        if (cancelled) return
        if (cfgData?.ok && cfgData.config) {
          const cfg = cfgData.config as SubscriptionConfig
          setSubConfig(cfg)
          setPeriodDays(cfg.defaultPeriodDays ?? 28)
          setPersonCount(cfg.minPersons ?? 1)
          const slots = getEnabledMealSlots(cfg)
          const days = suggestDeliveryDays(cfg, slots)
          setSelectedDays(days)
          const prefill = buildPrefillItems(
            cfg,
            (dishData?.dishes ?? []).map((d: any) => ({ id: d.id, tags: d.tags })),
            {
              enabledSlots: slots,
              deliveryDays: days,
              personCount: cfg.minPersons ?? 1,
              periodDays: cfg.defaultPeriodDays ?? 28,
            },
            [],
          )
          if (prefill.length) {
            setLines(
              prefill.map((p) => ({
                dishId: p.dishId,
                quantity: p.quantity,
                mealSlot: p.mealSlot ?? null,
                modifierIds: p.modifierIds ?? [],
              }))
            )
          }
        }
        if (dishData?.ok && Array.isArray(dishData.dishes)) {
          setDishes(dishData.dishes.map(mapDish))
        }
        if (Array.isArray(dishData?.categories)) setCategories(dishData.categories)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!resumeId || loading) return
    let cancelled = false
    fetch(`/api/subscriptions/${resumeId}`, {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...telegramInitHeaderRecord() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok || !data.subscription) return
        const s = data.subscription
        if (s.status !== 'PENDING' && s.status !== 'DRAFT') return
        setName(String(s.name || ''))
        setPeriodDays(Number(s.periodDays ?? 28))
        setPersonCount(Number(s.personCount ?? 1))
        if (Array.isArray(s.deliveryDays)) {
          setSelectedDays(s.deliveryDays.map((d: number) => (d === 0 ? 6 : d - 1)))
        }
        if (Array.isArray(s.items)) {
          setLines(
            s.items.map((it: any) => ({
              dishId: String(it.dishId),
              quantity: Number(it.quantity ?? 1),
              mealSlot: parseMealSlot(it.mealSlot),
              modifierIds: Array.isArray(it.modifierIds) ? it.modifierIds : [],
            }))
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [resumeId, loading])

  const refreshQuote = useCallback(async () => {
    if (!lines.length || !selectedDays.length) {
      setLiveQuote(null)
      return
    }
    const res = await fetch('/api/subscriptions/quote', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
      body: JSON.stringify({
        items: lines.map((l) => ({
          dishId: l.dishId,
          quantity: l.quantity,
          mealSlot: l.mealSlot,
          modifierIds: l.modifierIds,
        })),
        deliveryDays: selectedDays.map(wizardDayToJs),
        periodDays,
        personCount,
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok && data.quote) {
      setLiveQuote({ guestPrice: Number(data.quote.guestPrice ?? data.guestPrice), deliveriesInPeriod: data.quote.deliveriesInPeriod })
    }
  }, [lines, selectedDays, periodDays, personCount])

  useEffect(() => {
    const t = setTimeout(() => void refreshQuote(), 400)
    return () => clearTimeout(t)
  }, [refreshQuote])

  const dishesByCategory = useMemo(() => {
    const map: Record<string, Dish[]> = {}
    for (const d of dishes) {
      const cid = d.categoryId || 'uncat'
      if (!map[cid]) map[cid] = []
      map[cid].push(d)
    }
    return map
  }, [dishes])

  const visibleDishes = useMemo(() => {
    let list = categoryFilter === 'all' ? dishes : dishesByCategory[categoryFilter] ?? []
    if (activeSlot !== 'all') {
      const slotCfg = subConfig.mealSlots[activeSlot]
      const allowed = new Set(slotCfg?.dishIds ?? [])
      list = list.filter((d) => allowed.has(d.id))
    }
    return list
  }, [dishes, dishesByCategory, categoryFilter, activeSlot, subConfig])

  const categoryChips = useMemo(() => {
    const chips = [{ id: 'all', name: 'всё', emoji: null as string | null }]
    for (const c of categories) {
      if ((dishesByCategory[c.id]?.length ?? 0) > 0) chips.push({ id: c.id, name: c.name, emoji: c.emoji ?? null })
    }
    return chips
  }, [categories, dishesByCategory])

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((d) => d !== day)
        return next.length >= minDays ? next : prev
      }
      if (prev.length >= maxDays) return prev
      return [...prev, day].sort((a, b) => a - b)
    })
  }

  function addDish(dishId: string) {
    const slot = activeSlot === 'all' ? enabledSlots[0] ?? null : activeSlot
    const item: SelectedLine = { dishId, quantity: 1, mealSlot: slot, modifierIds: [] }
    setLines((prev) => {
      if (prev.some((x) => lineKey(x) === lineKey(item))) {
        toast.error('уже в рационе')
        return prev
      }
      return [...prev, item]
    })
  }

  function updateQty(target: SelectedLine, delta: number) {
    const k = lineKey(target)
    setLines((prev) =>
      prev
        .map((x) => (lineKey(x) === k ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x))
        .filter((x) => x.quantity > 0)
    )
  }

  function removeLine(target: SelectedLine) {
    setLines((prev) => prev.filter((x) => lineKey(x) !== lineKey(target)))
  }

  async function submit() {
    if (!name.trim()) {
      toast.error('введите название')
      return
    }
    if (!lines.length) {
      toast.error('выберите блюда')
      return
    }
    if (selectedDays.length < minDays) {
      toast.error(`минимум ${minDays} дней доставки`)
      return
    }
    setSubmitting(true)
    try {
      const plan: SubscriptionPlan = periodDays <= 7 ? 'WEEKLY' : periodDays <= 14 ? 'BIWEEKLY' : 'MONTHLY'
      const payload = {
        name: name.trim(),
        plan,
        personCount,
        periodDays,
        deliveryDays: selectedDays.map(wizardDayToJs),
        deliveryTime: '13:00',
        startDate: new Date().toISOString(),
        nextDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        price: Math.round(liveQuote?.guestPrice ?? 0),
        items: lines.map((l) => {
          const dish = dishes.find((d) => d.id === l.dishId)
          return {
            dishId: l.dishId,
            quantity: l.quantity,
            name: dish?.name,
            mealSlot: l.mealSlot,
            modifierIds: l.modifierIds,
          }
        }),
      }

      if (resumeId) {
        const res = await fetch(`/api/subscriptions/${resumeId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
          body: JSON.stringify({
            name: name.trim(),
            plan,
            personCount,
            periodDays,
            price: Math.round(liveQuote?.guestPrice ?? 0),
            deliveryDays: selectedDays.map(wizardDayToJs),
            items: payload.items,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          toast.error(data?.error || 'не удалось обновить')
          return
        }
        toast.success('заявка обновлена')
        router.push(`/subscriptions/${resumeId}`)
        return
      }

      const clientRequestId =
        createRequestIdRef.current ??
        (createRequestIdRef.current =
          (globalThis as any)?.crypto?.randomUUID?.() ? (globalThis as any).crypto.randomUUID() : String(Date.now()))
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
        body: JSON.stringify({ ...payload, clientRequestId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'не удалось отправить заявку')
        return
      }
      addSubscription({
        id: data.subscriptionId,
        name: name.trim(),
        plan,
        status: 'PENDING' as SubscriptionStatus,
        price: Math.round(liveQuote?.guestPrice ?? 0),
        deliveryDays: selectedDays.map(wizardDayToJs),
        deliveryTime: '13:00',
        startDate: new Date(),
        items: lines.map((l) => ({ ...l, dish: dishes.find((d) => d.id === l.dishId) })) as any,
      } as any)
      toast.success('отправлено на подтверждение')
      router.push(data.subscriptionId ? `/subscriptions/${data.subscriptionId}` : '/subscriptions')
    } finally {
      setSubmitting(false)
    }
  }

  const totalPrice = liveQuote?.guestPrice ?? 0
  const canNext =
    step === 0
      ? selectedDays.length >= minDays
      : step === 1
        ? lines.length > 0
        : Boolean(name.trim())

  if (loading) {
    return (
      <div className="ui-container ui-screen">
        <PageHeader backHref="/subscriptions" title="оформление подписки" />
        <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
      </div>
    )
  }

  return (
    <div className="ui-container flex min-h-[100dvh] flex-col pb-28">
      <div className="flex items-center gap-2">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="ui-back-button shrink-0" aria-label="назад">
            ‹
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <PageHeader
            backHref={step === 0 ? '/subscriptions' : undefined}
            title="оформление подписки"
            subtitle={resumeId ? 'редактирование заявки' : 'сбор рациона и отправка заведению'}
            compact
          />
        </div>
      </div>

      <div className="mb-4 flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              'h-1 flex-1 rounded-full transition',
              i <= step ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--stroke)]'
            )}
          />
        ))}
      </div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
        шаг {step + 1} · {STEPS[step]}
      </p>

      {step === 0 ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--stroke)] p-4">
            <p className="mb-2 text-[12px] font-bold uppercase text-[color:var(--muted)]">дни доставки</p>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={cn(
                    'flex aspect-square max-h-11 items-center justify-center rounded-full text-[12px] font-semibold',
                    selectedDays.includes(idx)
                      ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                      : 'border border-[color:var(--stroke)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--stroke)] p-4">
            <p className="mb-2 text-[12px] font-bold uppercase text-[color:var(--muted)]">персон</p>
            <div className="flex items-center gap-3">
              <button type="button" className="btn btn-soft h-9 w-9 rounded-full" onClick={() => setPersonCount((n) => Math.max(subConfig.minPersons, n - 1))}>−</button>
              <span className="text-[18px] font-bold tabular-nums">{personCount}</span>
              <button type="button" className="btn btn-soft h-9 w-9 rounded-full" onClick={() => setPersonCount((n) => Math.min(subConfig.maxPersons, n + 1))}>+</button>
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--stroke)] p-4">
            <p className="mb-2 text-[12px] font-bold uppercase text-[color:var(--muted)]">период</p>
            <div className="flex flex-wrap gap-2">
              {(subConfig.availablePeriods ?? [7, 14, 28]).map((d) => {
                const extra = getPeriodDiscountPercent(subConfig.periodDiscounts, d)
                const sel = periodDays === d
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPeriodDays(d)}
                    className={cn(
                      'relative rounded-xl border px-3 py-2 text-center',
                      sel ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]' : 'border-[color:var(--stroke)]'
                    )}
                  >
                    <span className="block text-[13px] font-bold">{periodLabel(d)}</span>
                    {extra > 0 ? (
                      <span className="absolute -right-1 -top-1 rounded-full bg-[color:var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                        −{extra}%
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3">
          {enabledSlots.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setActiveSlot('all')} className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold', activeSlot === 'all' ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]')}>
                все
              </button>
              {enabledSlots.map((s) => (
                <button key={s} type="button" onClick={() => setActiveSlot(s)} className={cn('rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize', activeSlot === s ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]')}>
                  {MEAL_SLOT_LABEL[s]}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {categoryChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[12px] font-semibold',
                  categoryFilter === c.id
                    ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
                    : 'border-[color:var(--stroke)]'
                )}
              >
                {c.emoji ? `${c.emoji} ` : ''}{c.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {visibleDishes.map((d) => {
              const inCart = lines.some((l) => l.dishId === d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => addDish(d.id)}
                  className={cn(
                    'overflow-hidden rounded-2xl border text-left transition active:scale-[0.98]',
                    inCart ? 'border-[color:var(--primary)]' : 'border-[color:var(--stroke)]'
                  )}
                >
                  <div className="relative h-32 w-full bg-black/5">
                    {d.image ? (
                      <OptimizedImage src={d.image} alt="" className="object-cover" sizes={IMAGE_SIZES.menuGrid} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[28px]">🍽</div>
                    )}
                    {inCart ? (
                      <span className="absolute right-2 top-2 rounded-full bg-[color:var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white">✓</span>
                    ) : null}
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{d.name}</p>
                    <p className="mt-1 text-[12px] font-bold tabular-nums">{formatPrice(d.price)}</p>
                  </div>
                </button>
              )
            })}
          </div>
          {lines.length > 0 ? (
            <div className="rounded-2xl border border-[color:var(--stroke)] p-3">
              <p className="mb-2 text-[11px] font-bold uppercase text-[color:var(--muted)]">ваш рацион · {lines.length}</p>
              <ul className="space-y-2">
                {lines.map((l) => {
                  const dish = dishes.find((d) => d.id === l.dishId)
                  return (
                    <li key={lineKey(l)} className="flex items-center gap-2">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/5">
                        {dish?.image ? <OptimizedImage src={dish.image} alt="" className="object-cover" sizes="40px" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{dish?.name ?? '—'}</p>
                        {l.mealSlot ? <p className="text-[10px] text-[color:var(--muted)]">{MEAL_SLOT_LABEL[l.mealSlot]}</p> : null}
                      </div>
                      <InlineCounter value={l.quantity} onDec={() => updateQty(l, -1)} onInc={() => updateQty(l, 1)} />
                      <button type="button" className="text-[12px] text-red-600" onClick={() => removeLine(l)}>×</button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--stroke)] p-4">
            <p className="text-[11px] font-bold uppercase text-[color:var(--muted)]">итого за период</p>
            <p className="text-[28px] font-extrabold tabular-nums">{formatPrice(totalPrice)}</p>
            <p className="mt-1 text-[12px] text-[color:var(--muted)]">
              {selectedDays.length} дн/нед · {periodLabel(periodDays)} · {personCount} перс.
            </p>
            <p className="mt-3 text-[12px] text-[color:var(--muted)]">
              После отправки заведение проверит рацион и подтвердит подписку в Telegram.
            </p>
          </div>
          <ul className="space-y-2 rounded-2xl border border-[color:var(--stroke)] p-3">
            {lines.map((l) => {
              const dish = dishes.find((d) => d.id === l.dishId)
              return (
                <li key={lineKey(l)} className="flex items-center gap-2 text-[13px]">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-black/5">
                    {dish?.image ? <OptimizedImage src={dish.image} alt="" className="object-cover" sizes="36px" /> : null}
                  </div>
                  <span className="flex-1 truncate">{l.quantity > 1 ? `${l.quantity}× ` : ''}{dish?.name}</span>
                  <span className="tabular-nums text-[color:var(--muted)]">{formatPrice((dish?.price ?? 0) * l.quantity)}</span>
                </li>
              )
            })}
          </ul>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">название подписки</span>
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="например: обед на неделю"
            />
          </label>
        </section>
      ) : null}

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/95 p-4 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="ui-container flex items-center gap-3">
          {totalPrice > 0 ? (
            <div className="min-w-0 shrink-0">
              <p className="text-[10px] uppercase text-[color:var(--muted)]">итого</p>
              <p className="text-[18px] font-extrabold tabular-nums">{formatPrice(totalPrice)}</p>
            </div>
          ) : null}
          <button
            type="button"
            disabled={!canNext || submitting}
            onClick={() => {
              if (step < 2) setStep((s) => s + 1)
              else void submit()
            }}
            className="btn btn-primary ml-auto h-12 flex-1 rounded-full text-[15px] font-bold disabled:opacity-50"
          >
            {submitting ? '…' : step < 2 ? 'далее' : resumeId ? 'сохранить заявку' : 'отправить на подтверждение'}
          </button>
        </div>
      </footer>
    </div>
  )
}
