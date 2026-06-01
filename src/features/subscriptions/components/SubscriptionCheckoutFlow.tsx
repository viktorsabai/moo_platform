'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import type { SubscriptionPlan, SubscriptionStatus } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import {
  defaultSubscriptionConfig,
  getEnabledMealSlots,
  type SubscriptionConfig,
} from '@/lib/subscription-config'
import { buildPrefillItems, suggestDeliveryDays } from '@/lib/subscription-prefill'
import { parseMealSlot, type MealSlot } from '@/lib/subscription-meal-slots'
import { useSubscriptionStore } from '@/store/subscription-store'
import { loadDeliveryProfile } from '@/lib/delivery-profile'
import { SubscriptionMenuPickerPhase } from '@/features/subscriptions/components/SubscriptionMenuPickerPhase'
import { SubscriptionCheckoutConfigPhase } from '@/features/subscriptions/components/SubscriptionCheckoutConfigPhase'
import {
  jsDayToWizard,
  lineKey,
  mapSubscriptionDish,
  type MenuCategory,
  type PeriodQuote,
  type SelectedLine,
  wizardDayToJs,
} from '@/features/subscriptions/lib/subscription-checkout-utils'

type Phase = 'menu' | 'checkout'

export function SubscriptionCheckoutFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume') || ''
  const addSubscription = useSubscriptionStore((s) => s.addSubscription)

  const [phase, setPhase] = useState<Phase>(resumeId ? 'checkout' : 'menu')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [subConfig, setSubConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [dishes, setDishes] = useState<ReturnType<typeof mapSubscriptionDish>[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2])
  const [periodDays, setPeriodDays] = useState(28)
  const [personCount, setPersonCount] = useState(1)
  const [deliveryTime, setDeliveryTime] = useState('13:00')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(12, 0, 0, 0)
    return d
  })
  const [lines, setLines] = useState<SelectedLine[]>([])
  const [name, setName] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [activeSlot, setActiveSlot] = useState<MealSlot | 'all'>('all')
  const [quotesByPeriod, setQuotesByPeriod] = useState<Record<number, PeriodQuote | undefined>>({})
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
            { enabledSlots: slots, deliveryDays: days, personCount: cfg.minPersons ?? 1, periodDays: cfg.defaultPeriodDays ?? 28 },
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
        if (dishData?.ok && Array.isArray(dishData.dishes)) setDishes(dishData.dishes.map(mapSubscriptionDish))
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
        setPhase('checkout')
        setName(String(s.name || ''))
        setPeriodDays(Number(s.periodDays ?? 28))
        setPersonCount(Number(s.personCount ?? 1))
        if (s.deliveryTime) setDeliveryTime(String(s.deliveryTime))
        if (s.startDate) {
          const sd = new Date(s.startDate)
          if (!Number.isNaN(sd.getTime())) setStartDate(sd)
        }
        if (Array.isArray(s.deliveryDays)) setSelectedDays(s.deliveryDays.map((d: number) => jsDayToWizard(d)))
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

  const quotePayload = useMemo(
    () => ({
      items: lines.map((l) => ({
        dishId: l.dishId,
        quantity: l.quantity,
        mealSlot: l.mealSlot,
        modifierIds: l.modifierIds,
      })),
      deliveryDays: selectedDays.map(wizardDayToJs),
      personCount,
    }),
    [lines, selectedDays, personCount]
  )

  const refreshQuotes = useCallback(async () => {
    if (!lines.length || !selectedDays.length) {
      setQuotesByPeriod({})
      return
    }
    const periods = subConfig.availablePeriods ?? [7, 14, 28]
    const results = await Promise.all(
      periods.map(async (p) => {
        const res = await fetch('/api/subscriptions/quote', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
          body: JSON.stringify({ ...quotePayload, periodDays: p }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !data.quote) return [p, undefined] as const
        const q = data.quote
        return [
          p,
          {
            guestPrice: Number(q.guestPrice ?? 0),
            periodRetail: Number(q.periodRetail ?? 0),
            guestSavingsPercent: Number(q.guestSavingsPercent ?? 0),
            deliveriesInPeriod: Number(q.deliveriesInPeriod ?? 0),
            perDeliveryRetail: Number(q.perDeliveryRetail ?? 0),
          },
        ] as const
      })
    )
    const map: Record<number, PeriodQuote | undefined> = {}
    for (const [p, q] of results) map[p] = q
    setQuotesByPeriod(map)
  }, [lines.length, quotePayload, selectedDays.length, subConfig.availablePeriods])

  useEffect(() => {
    const t = setTimeout(() => void refreshQuotes(), phase === 'checkout' ? 300 : 600)
    return () => clearTimeout(t)
  }, [refreshQuotes, phase, periodDays])

  const dishesByCategory = useMemo(() => {
    const map: Record<string, typeof dishes> = {}
    for (const d of dishes) {
      const cid = d.categoryId || 'uncat'
      if (!map[cid]) map[cid] = []
      map[cid].push(d)
    }
    return map
  }, [dishes])

  const activeQuote = quotesByPeriod[periodDays] ?? null
  const perDeliveryEstimate = activeQuote?.perDeliveryRetail ?? quotesByPeriod[subConfig.defaultPeriodDays ?? 28]?.perDeliveryRetail ?? 0

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
      toast.success('добавлено в рацион')
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

  function goToCheckout() {
    if (!lines.length) {
      toast.error('выберите хотя бы одно блюдо')
      return
    }
    setPhase('checkout')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      const price = Math.round(activeQuote?.guestPrice ?? 0)
      const payload = {
        name: name.trim(),
        plan,
        personCount,
        periodDays,
        deliveryDays: selectedDays.map(wizardDayToJs),
        deliveryTime,
        startDate: startDate.toISOString(),
        nextDelivery: startDate.toISOString(),
        price,
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
            price,
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
        price,
        deliveryDays: selectedDays.map(wizardDayToJs),
        deliveryTime,
        startDate: new Date(),
        items: lines.map((l) => ({ ...l, dish: dishes.find((d) => d.id === l.dishId) })) as any,
      } as any)
      toast.success('отправлено на подтверждение')
      router.push(data.subscriptionId ? `/subscriptions/${data.subscriptionId}` : '/subscriptions')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader backHref="/subscriptions" title="подписка" subtitle="загрузка меню" />
        <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
      </main>
    )
  }

  if (phase === 'menu') {
    return (
      <SubscriptionMenuPickerPhase
        categories={categories}
        dishes={dishes}
        dishesByCategory={dishesByCategory}
        lines={lines}
        categoryFilter={categoryFilter}
        tagFilter={tagFilter}
        activeSlot={activeSlot}
        enabledSlots={enabledSlots}
        subConfig={subConfig}
        perDeliveryEstimate={perDeliveryEstimate}
        onCategoryFilter={setCategoryFilter}
        onTagFilter={setTagFilter}
        onActiveSlot={setActiveSlot}
        onAddDish={addDish}
        onContinue={goToCheckout}
      />
    )
  }

  return (
    <SubscriptionCheckoutConfigPhase
      resumeId={resumeId}
      lines={lines}
      dishes={dishes}
      selectedDays={selectedDays}
      periodDays={periodDays}
      personCount={personCount}
      startDate={startDate}
      deliveryTime={deliveryTime}
      name={name}
      telegramContact={telegramContact}
      subConfig={subConfig}
      quotesByPeriod={quotesByPeriod}
      activeQuote={activeQuote}
      submitting={submitting}
      minDays={minDays}
      maxDays={maxDays}
      onBack={() => setPhase('menu')}
      onToggleDay={toggleDay}
      onPeriodDays={setPeriodDays}
      onPersonCount={(delta) =>
        setPersonCount((n) => Math.max(subConfig.minPersons, Math.min(subConfig.maxPersons, n + delta)))
      }
      onStartDate={setStartDate}
      onDeliveryTime={setDeliveryTime}
      onName={setName}
      onRemoveLine={removeLine}
      onUpdateQty={updateQty}
      onLineModifiers={setLineModifierIds}
      onAddMore={() => setPhase('menu')}
      onSubmit={() => void submit()}
    />
  )
}
