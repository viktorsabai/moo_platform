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
import { SubscriptionRationStrip } from '@/features/subscriptions/components/SubscriptionRationStrip'
import { SubscriptionDishOptionsPanel } from '@/features/subscriptions/components/SubscriptionDishOptionsPanel'
import { loadDeliveryProfile } from '@/lib/delivery-profile'

type MenuCategory = { id: string; name: string; slug: string; emoji?: string | null }
type SelectedLine = { dishId: string; quantity: number; mealSlot: MealSlot | null; modifierIds: string[] }

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function wizardDayToJs(d: number) {
  return d === 6 ? 0 : d + 1
}

function jsDayToWizard(d: number) {
  return d === 0 ? 6 : d - 1
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
  return `${item.dishId}:${item.mealSlot ?? 'any'}:${(item.modifierIds ?? []).join('|')}`
}

type CalendarCell = {
  key: string
  day: number
  weekday: string
  month: string
  isDelivery: boolean
  isStart: boolean
}

function buildPeriodCalendar(startDate: Date, periodDays: number, wizardDays: number[]): CalendarCell[] {
  const jsDays = new Set(wizardDays.map(wizardDayToJs))
  const cells: CalendarCell[] = []
  for (let i = 0; i < periodDays; i++) {
    const d = new Date(startDate)
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() + i)
    cells.push({
      key: d.toISOString().slice(0, 10),
      day: d.getDate(),
      weekday: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
      month: d.toLocaleDateString('ru-RU', { month: 'short' }),
      isDelivery: jsDays.has(d.getDay()),
      isStart: i === 0,
    })
  }
  return cells
}

function nearestDeliveryLabel(wizardDays: number[], time = '13:00') {
  if (!wizardDays.length) return 'выберите дни доставки'
  const todayWizard = jsDayToWizard(new Date().getDay())
  let next = wizardDays.find((d) => d >= todayWizard)
  if (next == null) next = wizardDays[0]
  return `ближайшая доставка: ${WEEKDAYS[next]} в ${time}`
}

export function SubscriptionCheckoutFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume') || ''
  const addSubscription = useSubscriptionStore((s) => s.addSubscription)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [subConfig, setSubConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [dishes, setDishes] = useState<Dish[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2])
  const [periodDays, setPeriodDays] = useState(28)
  const [personCount, setPersonCount] = useState(1)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(12, 0, 0, 0)
    return d
  })
  const [lines, setLines] = useState<SelectedLine[]>([])
  const [name, setName] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activeSlot, setActiveSlot] = useState<MealSlot | 'all'>('all')
  const [liveQuote, setLiveQuote] = useState<{ guestPrice: number; deliveriesInPeriod: number } | null>(null)
  const [telegramContact, setTelegramContact] = useState<string | null>(null)
  const createRequestIdRef = useRef<string | null>(null)

  const enabledSlots = useMemo(() => getEnabledMealSlots(subConfig), [subConfig])
  const minDays = subConfig.minDaysPerWeek
  const maxDays = subConfig.maxDaysPerWeek

  useEffect(() => {
    try {
      const u = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user
      if (u?.username) setTelegramContact(`@${String(u.username).replace(/^@/, '')}`)
      else if (u?.id) setTelegramContact(`tg ${u.id}`)
    } catch {
      // ignore
    }
    const profile = loadDeliveryProfile()
    if (profile?.name) setName((prev) => prev || profile.name)
  }, [])

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
          if (prefill.length && !resumeId) {
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
    void load()
    return () => {
      cancelled = true
    }
  }, [resumeId])

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
        if (s.startDate) {
          const sd = new Date(s.startDate)
          if (!Number.isNaN(sd.getTime())) setStartDate(sd)
        }
        if (Array.isArray(s.deliveryDays)) {
          setSelectedDays(s.deliveryDays.map((d: number) => jsDayToWizard(d)))
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
      setLiveQuote({
        guestPrice: Number(data.quote.guestPrice ?? data.guestPrice),
        deliveriesInPeriod: data.quote.deliveriesInPeriod,
      })
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

  const rationStripLines = useMemo(
    () =>
      lines.map((l) => {
        const dish = dishes.find((d) => d.id === l.dishId)
        return {
          key: lineKey(l),
          dishId: l.dishId,
          quantity: l.quantity,
          image: dish?.image,
          name: dish?.name ?? '—',
        }
      }),
    [lines, dishes]
  )

  const calendarCells = useMemo(
    () => buildPeriodCalendar(startDate, periodDays, selectedDays),
    [startDate, periodDays, selectedDays]
  )
  const deliveryCount = calendarCells.filter((c) => c.isDelivery).length

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

  function setLineModifierIds(target: SelectedLine, modifierIds: string[]) {
    const k = lineKey(target)
    setLines((prev) => prev.map((x) => (lineKey(x) === k ? { ...x, modifierIds } : x)))
  }

  async function submit() {
    if (!name.trim()) {
      toast.error('введите имя')
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
        startDate: startDate.toISOString(),
        nextDelivery: startDate.toISOString(),
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
  const canSubmit = Boolean(name.trim()) && lines.length > 0 && selectedDays.length >= minDays
  const submitCta = resumeId
    ? `сохранить · ${formatPrice(totalPrice)}`
    : `отправить · ${formatPrice(totalPrice)}`

  if (loading) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader backHref="/subscriptions" title="оформление" subtitle="подписка" />
        <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
      </main>
    )
  }

  return (
    <main className="ui-container ui-screen pb-[var(--ufo-scroll-pad-floating,calc(5.75rem+12px))]">
      <PageHeader
        backHref="/subscriptions"
        title="оформление"
        subtitle={resumeId ? 'редактирование заявки на подписку' : 'подписка · рацион и расписание'}
      />

      <div className="border-t border-[color:var(--stroke)]">
        {/* рацион — как блок «заказ» в чекауте */}
        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">рацион</h3>
          {lines.length > 0 ? (
            <SubscriptionRationStrip lines={rationStripLines} className="mb-3" />
          ) : (
            <p className="mb-3 text-[13px] text-[color:var(--muted)]">выберите блюда из меню ниже</p>
          )}

          {enabledSlots.length > 1 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveSlot('all')}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold',
                  activeSlot === 'all' ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
                )}
              >
                весь день
              </button>
              {enabledSlots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveSlot(s)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize',
                    activeSlot === s ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'border border-[color:var(--stroke)]'
                  )}
                >
                  {MEAL_SLOT_LABEL[s]}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
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
                {c.emoji ? `${c.emoji} ` : ''}
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {visibleDishes.map((d) => {
              const inCart = lines.some((l) => l.dishId === d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => addDish(d.id)}
                  className={cn(
                    'overflow-hidden rounded-[var(--radius-medium)] border text-left shadow-[var(--shadow-soft)] transition active:scale-[0.98]',
                    inCart ? 'border-[color:var(--primary)]' : 'border-[color:var(--stroke)]'
                  )}
                >
                  <div className="relative aspect-[4/3] w-full bg-black/5">
                    {d.image ? (
                      <OptimizedImage src={d.image} alt="" className="object-cover" sizes={IMAGE_SIZES.menuGrid} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[28px]">🍽</div>
                    )}
                    {inCart ? (
                      <span className="absolute right-2 top-2 rounded-full bg-[color:var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white">
                        ✓
                      </span>
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
            <ul className="mt-4 space-y-0 divide-y divide-[color:var(--stroke)] rounded-[var(--radius-medium)] border border-[color:var(--stroke)]">
              {lines.map((l) => {
                const dish = dishes.find((d) => d.id === l.dishId)
                if (!dish) return null
                return (
                  <li key={lineKey(l)} className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-medium)] bg-black/5">
                        {dish.image ? (
                          <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.checkoutThumb} />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{dish.name}</p>
                        {l.mealSlot ? (
                          <p className="text-[11px] text-[color:var(--muted)]">{MEAL_SLOT_LABEL[l.mealSlot]}</p>
                        ) : null}
                      </div>
                      <InlineCounter value={l.quantity} onDec={() => updateQty(l, -1)} onInc={() => updateQty(l, 1)} />
                      <button type="button" className="text-[18px] leading-none text-[color:var(--muted)]" onClick={() => removeLine(l)} aria-label="убрать">
                        ×
                      </button>
                    </div>
                    <SubscriptionDishOptionsPanel
                      dish={dish}
                      modifierIds={l.modifierIds ?? []}
                      onChange={(ids) => setLineModifierIds(l, ids)}
                    />
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>

        {/* расписание + календарь */}
        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">расписание</h3>
          <p className="mb-3 text-[13px] text-[color:var(--text)]">{nearestDeliveryLabel(selectedDays)}</p>

          <div className="mb-3 grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(idx)}
                className={cn(
                  'flex aspect-square max-h-11 items-center justify-center rounded-full text-[12px] font-semibold transition active:scale-[0.96]',
                  selectedDays.includes(idx)
                    ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                    : 'border border-[color:var(--stroke)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[color:var(--muted)]">старт подписки</span>
            <input
              type="date"
              value={startDate.toISOString().slice(0, 10)}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                const d = new Date(e.target.value + 'T12:00:00')
                if (!Number.isNaN(d.getTime())) setStartDate(d)
              }}
              className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-transparent px-2 py-1.5 text-[13px] font-semibold tabular-nums"
            />
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[color:var(--muted)]">календарь · {periodLabel(periodDays)}</span>
            <span className="text-[12px] tabular-nums text-[color:var(--text)]">
              {deliveryCount} доставок
            </span>
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {calendarCells.map((cell) => (
              <div
                key={cell.key}
                className={cn(
                  'flex w-[52px] shrink-0 flex-col items-center rounded-[var(--radius-medium)] border px-1 py-2 text-center',
                  cell.isDelivery
                    ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]'
                    : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]',
                  cell.isStart && 'ring-2 ring-[color:var(--primary)] ring-offset-1'
                )}
              >
                <span className="text-[9px] font-bold uppercase opacity-80">{cell.weekday}</span>
                <span className="text-[16px] font-extrabold tabular-nums">{cell.day}</span>
                <span className="text-[9px] opacity-70">{cell.month}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-b border-[color:var(--stroke)] py-2.5">
            <span className="ui-muted shrink-0">персон</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-soft h-8 w-8 rounded-full text-[16px]"
                onClick={() => setPersonCount((n) => Math.max(subConfig.minPersons, n - 1))}
              >
                −
              </button>
              <span className="min-w-[2ch] text-center text-[15px] font-bold tabular-nums">{personCount}</span>
              <button
                type="button"
                className="btn btn-soft h-8 w-8 rounded-full text-[16px]"
                onClick={() => setPersonCount((n) => Math.min(subConfig.maxPersons, n + 1))}
              >
                +
              </button>
            </div>
          </div>

          <div className="pt-3">
            <span className="mb-2 block text-[12px] font-semibold text-[color:var(--muted)]">период</span>
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
                      'relative min-w-[88px] rounded-xl border px-3 py-2.5 text-center transition',
                      sel ? 'border-[color:var(--text)] bg-[color:var(--text)] text-[color:var(--surface)]' : 'border-[color:var(--stroke)]'
                    )}
                  >
                    <span className="block text-[13px] font-bold">{periodLabel(d)}</span>
                    <span className="mt-0.5 block text-[10px] opacity-80">{d} дн.</span>
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

        {/* контакт */}
        <section className="border-b border-[color:var(--stroke)] py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">контакт</h3>
          <div className="flex items-center justify-between border-b border-[color:var(--stroke)] py-2.5">
            <span className="ui-muted shrink-0">имя</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="как к вам обращаться"
              className="ui-body ml-3 w-[65%] border-none bg-transparent p-0 text-right outline-none placeholder:text-[color:var(--muted)]"
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="ui-muted shrink-0">telegram</span>
            <span className="ui-body ml-3 text-right text-[14px] font-semibold">{telegramContact || 'из mini app'}</span>
          </div>
        </section>

        {/* итого */}
        <section className="py-3">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">итого</h3>
          <div className="flex items-center justify-between py-2">
            <span className="text-[14px] font-semibold">за период</span>
            <span className="text-[22px] font-extrabold tabular-nums">{formatPrice(totalPrice)}</span>
          </div>
          <p className="text-[12px] text-[color:var(--muted)]">
            {selectedDays.length} дн/нед · {periodLabel(periodDays)} · {personCount} перс. · {lines.length} блюд
          </p>
          <p className="mt-2 text-[12px] text-[color:var(--muted)]">
            После отправки заведение проверит рацион и подтвердит подписку в Telegram.
          </p>
        </section>
      </div>

      <div className="pointer-events-none fixed bottom-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+8px)] left-1/2 z-[115] w-[min(640px,96%)] max-w-full -translate-x-1/2">
        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={() => void submit()}
          className="pointer-events-auto btn btn-primary h-12 w-full text-[16px] disabled:opacity-50"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          {submitting ? '…' : submitCta}
        </button>
      </div>
    </main>
  )
}
