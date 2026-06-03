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
import { buildPrefillItemsPerDay, suggestDeliveryDays } from '@/lib/subscription-prefill'
import { MEAL_SLOT_LABEL, parseMealSlot, type MealSlot } from '@/lib/subscription-meal-slots'
import { useSubscriptionStore } from '@/store/subscription-store'
import { loadDeliveryProfile } from '@/lib/delivery-profile'
import { useVenue } from '@/lib/venue-context'
import {
  clearSubscriptionBuilderDraft,
  loadSubscriptionBuilderDraft,
  saveSubscriptionBuilderDraft,
} from '@/lib/subscription-builder-draft'
import { SubscriptionBuildPhase } from '@/features/subscriptions/components/SubscriptionBuildPhase'
import { itemsPerDeliveryBySlot } from '@/lib/subscription-meal-slot-rules'
import { SubscriptionCheckoutConfigPhase } from '@/features/subscriptions/components/SubscriptionCheckoutConfigPhase'
import { SubscriptionDishOptionsSheet } from '@/features/subscriptions/components/SubscriptionDishOptionsSheet'
import {
  buildRequiredSlotsByJsDay,
  categoriesFromDishes,
  dishHasConfigurableOptions,
  jsDayToWizard,
  lineKey,
  mapSubscriptionDish,
  parseJsonArray,
  guestCatalogDishIds,
  type MenuCategory,
  type PeriodQuote,
  type SelectedLine,
  WEEKDAYS,
  wizardDayToJs,
} from '@/features/subscriptions/lib/subscription-checkout-utils'

type Phase = 'build' | 'checkout'

export function SubscriptionCheckoutFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume') || ''
  const { restaurantId } = useVenue()
  const addSubscription = useSubscriptionStore((s) => s.addSubscription)
  const draftHydratedRef = useRef(false)

  const [phase, setPhase] = useState<Phase>(resumeId ? 'checkout' : 'build')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [subConfig, setSubConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [dishes, setDishes] = useState<ReturnType<typeof mapSubscriptionDish>[]>([])
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [activeWizardDay, setActiveWizardDay] = useState(1)
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
  const [activeSlot, setActiveSlot] = useState<MealSlot>('lunch')
  const [quotesByPeriod, setQuotesByPeriod] = useState<Record<number, PeriodQuote | undefined>>({})
  const [telegramContact, setTelegramContact] = useState<string | null>(null)
  const [slotsByWizardDay, setSlotsByWizardDay] = useState<Record<number, MealSlot[]>>({})
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([])
  const [editingLine, setEditingLine] = useState<SelectedLine | null>(null)
  const createRequestIdRef = useRef<string | null>(null)

  const enabledSlots = useMemo(() => getEnabledMealSlots(subConfig), [subConfig])

  const slotsForActiveDay = useMemo(() => {
    const custom = slotsByWizardDay[activeWizardDay]
    return custom?.length ? custom : enabledSlots
  }, [slotsByWizardDay, activeWizardDay, enabledSlots])

  const requiredMealSlotsByDay = useMemo(
    () => buildRequiredSlotsByJsDay(selectedDays, slotsByWizardDay, enabledSlots),
    [selectedDays, slotsByWizardDay, enabledSlots]
  )
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
        const dishJson = await dishRes.json().catch(() => [])
        let dishList = dishRes.ok ? parseJsonArray<any>(dishJson) : []
        if (dishList.length === 0) {
          const allRes = await fetch('/api/dishes', {
            cache: 'no-store',
            credentials: 'include',
            headers: { ...telegramInitHeaderRecord() },
          })
          const allJson = await allRes.json().catch(() => [])
          if (allRes.ok) dishList = parseJsonArray<any>(allJson)
        }
        if (cancelled) return
        if (cfgData?.ok && cfgData.config) {
          const cfg = cfgData.config as SubscriptionConfig
          setSubConfig(cfg)
          setPeriodDays(cfg.defaultPeriodDays ?? 28)
          setPersonCount(cfg.minPersons ?? 1)
          const slots = getEnabledMealSlots(cfg)
          if (slots.length) setActiveSlot(slots[0])
          const days = suggestDeliveryDays(cfg, slots)
          setSelectedDays(days)
          setActiveWizardDay(days[0] ?? 1)
          const initialSlots: Record<number, MealSlot[]> = {}
          for (const d of days) initialSlots[d] = [...slots]
          setSlotsByWizardDay(initialSlots)
        }
        const mappedDishes = dishList.map(mapSubscriptionDish)
        setDishes(mappedDishes)
        setMenuCategories(categoriesFromDishes(mappedDishes, []))
        try {
          const catRes = await fetch('/api/categories', {
            cache: 'no-store',
            credentials: 'include',
            headers: { ...telegramInitHeaderRecord() },
          })
          const catData = await catRes.json().catch(() => null)
          if (!cancelled && catRes.ok && catData) {
            const raw = Array.isArray(catData) ? catData : parseJsonArray(catData)
            const apiCats: MenuCategory[] = raw.map((c: any) => ({
              id: String(c.id),
              name: String(c.name ?? 'меню'),
              slug: String(c.slug ?? c.id),
              emoji: c.emoji ?? null,
            }))
            setMenuCategories(categoriesFromDishes(mappedDishes, apiCats))
          }
        } catch {
          // ignore
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [resumeId])

  function applyPrefillForDays(wizardDays: number[], cfg: SubscriptionConfig, mappedDishes: ReturnType<typeof mapSubscriptionDish>[]) {
    const slots = getEnabledMealSlots(cfg)
    void (async () => {
      let favoriteIds: string[] = []
      try {
        const favRes = await fetch('/api/favorites', {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord() },
        })
        const favData = await favRes.json().catch(() => null)
        if (favRes.ok && Array.isArray(favData?.ids)) favoriteIds = favData.ids.map(String)
      } catch {
        // ignore
      }
      const prefill = buildPrefillItemsPerDay(
        cfg,
        mappedDishes.map((d) => ({ id: d.id, tags: d.tags })),
        wizardDays,
        favoriteIds
      )
      if (prefill.length) {
        setLines(
          prefill.map((it) => ({
            dishId: it.dishId,
            quantity: it.quantity,
            mealSlot: parseMealSlot(it.mealSlot),
            modifierIds: it.modifierIds ?? [],
            dayOfWeek: it.dayOfWeek ?? wizardDayToJs(wizardDays[0] ?? 1),
          }))
        )
      }
    })()
  }

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
        if (Array.isArray(s.deliveryDays)) {
          const wiz = s.deliveryDays.map((d: number) => jsDayToWizard(d))
          setSelectedDays(wiz)
          setActiveWizardDay(wiz[0] ?? 1)
        }
        if (Array.isArray(s.items)) {
          setLines(
            s.items.map((it: any) => ({
              dishId: String(it.dishId),
              quantity: Number(it.quantity ?? 1),
              mealSlot: parseMealSlot(it.mealSlot),
              modifierIds: Array.isArray(it.modifierIds) ? it.modifierIds : [],
              dayOfWeek:
                it.dayOfWeek != null && Number(it.dayOfWeek) >= 0 && Number(it.dayOfWeek) <= 6
                  ? Number(it.dayOfWeek)
                  : wizardDayToJs(jsDayToWizard(s.deliveryDays?.[0] ?? 1)),
            }))
          )
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [resumeId, loading])

  useEffect(() => {
    if (loading || resumeId || draftHydratedRef.current) return
    const draft = loadSubscriptionBuilderDraft(restaurantId)
    if (!draft?.lines?.length) return
    draftHydratedRef.current = true
    setLines(draft.lines as SelectedLine[])
    if (draft.selectedDays?.length) {
      setSelectedDays(draft.selectedDays)
      setActiveWizardDay(draft.activeWizardDay ?? draft.selectedDays[0])
    }
    if (draft.activeSlot) setActiveSlot(draft.activeSlot)
    if (draft.slotsByWizardDay && Object.keys(draft.slotsByWizardDay).length) {
      setSlotsByWizardDay(draft.slotsByWizardDay)
    }
    if (draft.periodDays) setPeriodDays(draft.periodDays)
    if (draft.personCount) setPersonCount(draft.personCount)
    if (draft.deliveryTime) setDeliveryTime(draft.deliveryTime)
    if (draft.startDate) {
      const sd = new Date(draft.startDate)
      if (!Number.isNaN(sd.getTime())) setStartDate(sd)
    }
    if (draft.name) setName(draft.name)
    if (draft.phase === 'checkout') setPhase('checkout')
  }, [loading, resumeId, restaurantId])

  useEffect(() => {
    if (loading || resumeId) return
    const t = setTimeout(() => {
      if (!lines.length && !selectedDays.length) return
      saveSubscriptionBuilderDraft(restaurantId, {
        v: 1,
        updatedAt: Date.now(),
        phase,
        selectedDays,
        activeWizardDay,
        activeSlot,
        periodDays,
        personCount,
        deliveryTime,
        startDate: startDate.toISOString(),
        name,
        lines: lines.map((l) => ({
          dishId: l.dishId,
          quantity: l.quantity,
          mealSlot: l.mealSlot,
          modifierIds: l.modifierIds ?? [],
          dayOfWeek: l.dayOfWeek,
        })),
        slotsByWizardDay,
      })
    }, 450)
    return () => clearTimeout(t)
  }, [
    loading,
    resumeId,
    restaurantId,
    phase,
    lines,
    selectedDays,
    activeWizardDay,
    activeSlot,
    periodDays,
    personCount,
    deliveryTime,
    startDate,
    name,
  ])

  const quotePayload = useMemo(
    () => ({
      items: lines.map((l) => ({
        dishId: l.dishId,
        quantity: l.quantity,
        mealSlot: l.mealSlot,
        modifierIds: l.modifierIds,
        dayOfWeek: l.dayOfWeek,
      })),
      deliveryDays: selectedDays.map(wizardDayToJs),
      requiredMealSlotsByDay,
      personCount,
    }),
    [lines, selectedDays, personCount, requiredMealSlotsByDay]
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
    const t = setTimeout(() => void refreshQuotes(), phase === 'checkout' ? 300 : 500)
    return () => clearTimeout(t)
  }, [refreshQuotes, phase, periodDays])

  const catalogDishes = useMemo(() => {
    const allowed = guestCatalogDishIds(subConfig)
    if (!allowed) return dishes
    return dishes.filter((d) => allowed.has(d.id))
  }, [dishes, subConfig])

  const dishesForSlot = useMemo(() => {
    const ids = subConfig.mealSlots[activeSlot]?.dishIds ?? []
    let list = catalogDishes
    if (ids.length > 0) {
      const allowed = new Set(ids)
      list = list.filter((d) => allowed.has(d.id))
    }
    return list
  }, [catalogDishes, subConfig, activeSlot])

  const recommendedDishIds = useMemo(() => {
    const sc = subConfig.mealSlots[activeSlot]
    const defs = sc?.defaultDishIds?.length ? sc.defaultDishIds : (sc?.dishIds ?? []).slice(0, 4)
    return defs.filter((id) => dishesForSlot.some((d) => d.id === id))
  }, [subConfig, activeSlot, dishesForSlot])

  const activeQuote = quotesByPeriod[periodDays] ?? null

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      let next: number[]
      if (prev.includes(day)) {
        next = prev.filter((d) => d !== day)
        if (next.length < minDays) return prev
        setSlotsByWizardDay((s) => {
          const copy = { ...s }
          delete copy[day]
          return copy
        })
      } else {
        if (prev.length >= maxDays) return prev
        next = [...prev, day].sort((a, b) => a - b)
        setSlotsByWizardDay((s) => ({ ...s, [day]: s[day] ?? [...enabledSlots] }))
      }
      setLines((linesPrev) => linesPrev.filter((l) => next.some((w) => wizardDayToJs(w) === l.dayOfWeek)))
      if (!next.includes(activeWizardDay)) setActiveWizardDay(next[0] ?? day)
      return next
    })
  }

  function toggleMealSlotForDay(slot: MealSlot) {
    const js = wizardDayToJs(activeWizardDay)
    const cur = slotsByWizardDay[activeWizardDay] ?? [...enabledSlots]
    const has = cur.includes(slot)
    if (has && cur.length <= 1) {
      toast.error('нужен хотя бы один приём пищи в этот день')
      return
    }
    const nextSlots = has ? cur.filter((s) => s !== slot) : [...cur, slot]
    if (has) {
      setLines((linesPrev) => linesPrev.filter((l) => !(l.dayOfWeek === js && l.mealSlot === slot)))
    }
    if (has && activeSlot === slot && nextSlots[0]) setActiveSlot(nextSlots[0])
    setSlotsByWizardDay((prev) => ({ ...prev, [activeWizardDay]: nextSlots }))
  }

  useEffect(() => {
    if (!slotsForActiveDay.includes(activeSlot) && slotsForActiveDay[0]) {
      setActiveSlot(slotsForActiveDay[0])
    }
  }, [slotsForActiveDay, activeSlot])

  useEffect(() => {
    if (phase !== 'build' || loading || draftHydratedRef.current || lines.length > 0 || selectedDays.length < minDays)
      return
    applyPrefillForDays(selectedDays, subConfig, dishes)
  }, [phase, loading, lines.length, selectedDays, minDays, subConfig, dishes])

  function addDish(dishId: string) {
    const dayOfWeek = wizardDayToJs(activeWizardDay)
    const dish = dishes.find((d) => d.id === dishId)
    const item: SelectedLine = { dishId, quantity: 1, mealSlot: activeSlot, modifierIds: [], dayOfWeek }
    setLines((prev) => {
      const k = lineKey(item)
      const existing = prev.find((x) => lineKey(x) === k)
      if (existing) {
        if (dish && dishHasConfigurableOptions(dish)) {
          setEditingLine(existing)
          return prev
        }
        return prev.filter((x) => lineKey(x) !== k)
      }

      const dayItems = prev.filter((l) => l.dayOfWeek === dayOfWeek)
      const bySlot = itemsPerDeliveryBySlot(dayItems)
      const max = subConfig.mealSlots[activeSlot]?.maxItemsPerDelivery ?? 0
      const maxForSlot = max <= 0 ? 999 : max
      if ((bySlot[activeSlot] ?? 0) >= maxForSlot) {
        toast.error(`в ${MEAL_SLOT_LABEL[activeSlot]} не более ${maxForSlot} блюд`)
        return prev
      }
      const next = [...prev, item]
      if (dish && dishHasConfigurableOptions(dish)) setEditingLine(item)
      return next
    })
  }

  function handleDayCell(wizardDay: number) {
    if (selectedDays.includes(wizardDay)) {
      setActiveWizardDay(wizardDay)
      return
    }
    toggleDay(wizardDay)
    setActiveWizardDay(wizardDay)
  }

  function copyActiveDayToAllWeek() {
    const fromJs = wizardDayToJs(activeWizardDay)
    const template = lines.filter((l) => l.dayOfWeek === fromJs)
    if (!template.length) {
      toast.error(`сначала добавьте блюда на ${WEEKDAYS[activeWizardDay]}`)
      return
    }
    const jsSet = new Set(selectedDays.map(wizardDayToJs))
    const templateSlots = slotsByWizardDay[activeWizardDay] ?? [...enabledSlots]
    setLines((prev) => {
      const other = prev.filter((l) => !jsSet.has(l.dayOfWeek))
      const expanded = selectedDays.flatMap((d) =>
        template.map((l) => ({
          ...l,
          dayOfWeek: wizardDayToJs(d),
          modifierIds: [...(l.modifierIds ?? [])],
        }))
      )
      return [...other, ...expanded]
    })
    setSlotsByWizardDay((prev) => {
      const next = { ...prev }
      for (const d of selectedDays) next[d] = [...templateSlots]
      return next
    })
    toast.success('меню и приёмы скопированы на все дни')
  }

  function clearActiveDay() {
    const js = wizardDayToJs(activeWizardDay)
    setLines((prev) => prev.filter((l) => l.dayOfWeek !== js))
  }

  function copyFromPreviousDay() {
    const idx = selectedDays.indexOf(activeWizardDay)
    if (idx <= 0) {
      toast.error('нет предыдущего дня доставки')
      return
    }
    const prevW = selectedDays[idx - 1]!
    const fromJs = wizardDayToJs(prevW)
    const toJs = wizardDayToJs(activeWizardDay)
    const template = lines.filter((l) => l.dayOfWeek === fromJs)
    if (!template.length) {
      toast.error(`сначала заполните ${WEEKDAYS[prevW]}`)
      return
    }
    const templateSlots = slotsByWizardDay[prevW] ?? [...enabledSlots]
    setLines((prev) => {
      const other = prev.filter((l) => l.dayOfWeek !== toJs)
      const copied = template.map((l) => ({
        ...l,
        dayOfWeek: toJs,
        modifierIds: [...(l.modifierIds ?? [])],
      }))
      return [...other, ...copied]
    })
    setSlotsByWizardDay((prev) => ({ ...prev, [activeWizardDay]: [...templateSlots] }))
    toast.success(`скопировано с ${WEEKDAYS[prevW]}`)
  }

  function daySlotsComplete(wizardDay: number) {
    const js = wizardDayToJs(wizardDay)
    const required = slotsByWizardDay[wizardDay] ?? enabledSlots
    if (!required.length) return false
    return required.every((slot) => lines.some((l) => l.dayOfWeek === js && l.mealSlot === slot))
  }

  function goToCheckout() {
    for (const d of selectedDays) {
      if (!daySlotsComplete(d)) {
        setActiveWizardDay(d)
        const required = slotsByWizardDay[d] ?? enabledSlots
        const missing = required.find((s) => !lines.some((l) => l.dayOfWeek === wizardDayToJs(d) && l.mealSlot === s))
        toast.error(`на ${WEEKDAYS[d]} добавьте ${missing ? MEAL_SLOT_LABEL[missing] : 'блюда'}`)
        return
      }
    }
    setPhase('checkout')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  function itemsPayload() {
    return lines.map((l) => {
      const dish = dishes.find((d) => d.id === l.dishId)
      return {
        dishId: l.dishId,
        quantity: l.quantity,
        name: dish?.name,
        mealSlot: l.mealSlot,
        dayOfWeek: l.dayOfWeek,
        modifierIds: l.modifierIds,
      }
    })
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
        items: itemsPayload(),
        requiredMealSlotsByDay,
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
      clearSubscriptionBuilderDraft(restaurantId)
      toast.success('отправлено на подтверждение')
      router.push(data.subscriptionId ? `/subscriptions/${data.subscriptionId}` : '/subscriptions')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader backHref="/subscriptions" title="новая подписка" subtitle="загрузка" />
        <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
      </main>
    )
  }

  if (phase === 'build') {
    return (
      <>
      <SubscriptionBuildPhase
        selectedDays={selectedDays}
        activeWizardDay={activeWizardDay}
        activeSlot={activeSlot}
        slotsForActiveDay={slotsForActiveDay}
        slotsByWizardDay={slotsByWizardDay}
        enabledSlots={enabledSlots}
        pickerDishes={dishesForSlot}
        lines={lines}
        recommendedDishIds={recommendedDishIds}
        menuCategories={menuCategories}
        subConfig={subConfig}
        minDays={minDays}
        maxDays={maxDays}
        quotesByPeriod={quotesByPeriod}
        periodDays={periodDays}
        onDayCell={handleDayCell}
        onToggleMealSlot={toggleMealSlotForDay}
        onActiveSlot={setActiveSlot}
        onAddDish={addDish}
        onEditLine={(line) => setEditingLine(line)}
        onCopyToAllWeek={copyActiveDayToAllWeek}
        onCopyFromPrevDay={copyFromPreviousDay}
        onClearDay={clearActiveDay}
        onContinue={goToCheckout}
        onOpenPay={goToCheckout}
      />
      {editingLine ? (
        (() => {
          const dish = dishes.find((d) => d.id === editingLine.dishId)
          if (!dish) return null
          return (
            <SubscriptionDishOptionsSheet
              line={editingLine}
              dish={dish}
              subConfig={subConfig}
              onChange={(ids) => {
                setLineModifierIds(editingLine, ids)
                setEditingLine((prev) => (prev ? { ...prev, modifierIds: ids } : null))
              }}
              onClose={() => setEditingLine(null)}
            />
          )
        })()
      ) : null}
      </>
    )
  }

  return (
    <SubscriptionCheckoutConfigPhase
      resumeId={resumeId}
      lines={lines}
      dishes={dishes}
      selectedDays={selectedDays}
      slotsByWizardDay={slotsByWizardDay}
      enabledSlots={enabledSlots}
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
      daysLocked
      onBack={() => setPhase('build')}
      onGoBuild={() => setPhase('build')}
      onPeriodDays={setPeriodDays}
      onPersonCount={(delta) =>
        setPersonCount((n) => Math.max(subConfig.minPersons, Math.min(subConfig.maxPersons, n + delta)))
      }
      onStartDate={setStartDate}
      onDeliveryTime={setDeliveryTime}
      onName={setName}
      onEditRation={() => setPhase('build')}
      onSubmit={() => void submit()}
    />
  )
}
