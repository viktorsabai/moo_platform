'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import type { Dish, SubscriptionPlan, SubscriptionStatus } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { useSubscriptionStore } from '@/store/subscription-store'
import toast from 'react-hot-toast'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconBell, IconCard, IconCart, IconChevronDown, IconChevronLeft, IconMapPin, IconPencil, IconPlus, IconReceipt } from '@/components/ui/icons'
import Link from 'next/link'
import { getDefaultPlanBySlug, getPrefilledDishesForPlan } from '@/lib/subscription-plans'
import {
  SubscriptionWizardStep,
  WIZARD_STEPS_ORDER,
  getNextStep,
  getPrevStep,
  canEnterAdjustDishes,
} from '@/lib/subscription-rules'
import { MEAL_SLOT_IDS, MEAL_SLOT_LABEL, type MealSlot, parseMealSlot } from '@/lib/subscription-meal-slots'
import { SubscriptionConstructorSummaryBar } from '@/features/subscriptions/components/SubscriptionConstructorSummaryBar'
import { SubscriptionDishOptionsPanel } from '@/features/subscriptions/components/SubscriptionDishOptionsPanel'
import { SubscriptionRationStrip } from '@/features/subscriptions/components/SubscriptionRationStrip'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { subscriptionPlanPresetGradient } from '@/lib/subscription-plan-visual'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import { defaultSubscriptionConfig, getEnabledMealSlots } from '@/lib/subscription-config'
import { buildPrefillItems, suggestDeliveryDays } from '@/lib/subscription-prefill'
import { resolveMealSlotRules } from '@/lib/subscription-meal-slot-rules'

type MenuCategory = { id: string; name: string; slug: string }

function normalizeJsDayToWizard(day: number): number {
  return day === 0 ? 6 : day - 1
}

function normalizeWizardDayToJs(day: number): number {
  return day === 6 ? 0 : day + 1
}

function mapDishFromApi(d: any): Dish {
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

const GOALS = [
  { id: 'simple', title: 'просто удобно', desc: 'быстро собрать рацион и не думать' },
  { id: 'fit', title: 'попроще и полегче', desc: 'баланс, салаты, гарниры' },
  { id: 'family', title: 'для семьи / пары', desc: 'разнообразие на несколько человек' },
] as const

type GoalId = (typeof GOALS)[number]['id']

type SelectedDish = { dishId: string; quantity: number; mealSlot: MealSlot | null; modifierIds: string[] }

/** Создание: готовый план заведения или свой рацион без привязки к шаблону (POST без planTemplateId). */
type SubscriptionBuildMode = 'from_plan' | 'custom'

function normalizeModifierIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map((x) => String(x || '').trim()).filter(Boolean))].sort()
}

function lineKey(item: SelectedDish): string {
  const mods = normalizeModifierIds(item.modifierIds).join('|')
  return `${item.dishId}\0${item.mealSlot ?? 'any'}\0${mods}`
}

/** Стабильный id для scrollIntoView из мозаики рациона. */
function rationRowElementId(item: SelectedDish): string {
  const k = lineKey(item)
  let h = 2166136261
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619)
  return `ration-row-${item.dishId}-${(h >>> 0).toString(36)}`
}

function lineUnitPrice(dish: Dish | undefined, modifierIds: string[]): number {
  if (!dish) return 0
  let p = Number(dish.price ?? 0)
  const set = new Set(modifierIds)
  for (const m of dish.modifiers ?? []) {
    if (set.has(m.id)) p += Number(m.priceAdjust ?? 0)
  }
  for (const g of dish.optionGroups ?? []) {
    for (const v of g.values ?? []) {
      if (set.has(v.id)) p += Number(v.priceAdjust ?? 0)
    }
  }
  return p
}

function modifierLabelsForDish(dish: Dish, modifierIds: string[]): string[] {
  const labels: string[] = []
  const seen = new Set<string>()
  for (const id of normalizeModifierIds(modifierIds)) {
    const m = dish.modifiers?.find((x) => x.id === id)
    if (m) {
      if (!seen.has(m.name)) {
        seen.add(m.name)
        labels.push(m.name)
      }
      continue
    }
    let found: string | null = null
    for (const g of dish.optionGroups ?? []) {
      const v = g.values?.find((x) => x.id === id)
      if (v) {
        found = v.name
        break
      }
    }
    if (found && !seen.has(found)) {
      seen.add(found)
      labels.push(found)
    }
  }
  return labels
}

/** Разрешённые правила плана с бэкенда (единый источник с POST/PATCH подписок). */
type ResolvedPlanRulesFromApi = {
  allowedCategoryIds: string[]
  categoryLimits: Record<string, number>
  minDishesPerDelivery: number
  maxDishesPerDelivery: number
  minDaysPerWeek: number
  maxDaysPerWeek: number
}

type PlanTemplate = {
  id: string
  name: string
  description?: string | null
  coverImageUrl?: string | null
  price: number
  plan: SubscriptionPlan
  planMode?: 'READY' | 'CUSTOM'
  pricingMode?: 'FIXED' | 'MENU' | 'MENU_DISCOUNT'
  menuDiscountPercent?: number | null
  availablePeriods?: number[]
  cycleDaysMin?: number | null
  cycleDaysMax?: number | null
  configuration?: Record<string, unknown> | null
  presetSlug?: string | null
  allowedCategoryIds?: string[]
  categoryLimits?: Record<string, number> | null
  minDishesPerDelivery?: number | null
  maxDishesPerDelivery?: number | null
  minDaysPerWeek?: number | null
  maxDaysPerWeek?: number | null
  /** Заполняется GET /api/subscriptions/plans через getPlanRules — единый источник правил. */
  rules?: ResolvedPlanRulesFromApi
}
function templateHardOptionIds(template: PlanTemplate | null): string[] {
  const raw = (template?.configuration as any)?.hardOptionIds
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x || '').trim()).filter(Boolean)
}
const PLAN_LABEL: Record<SubscriptionPlan, string> = { WEEKLY: 'нед', BIWEEKLY: '2 нед', MONTHLY: 'мес' }

function categoryTitle(categoryId: string, categories: MenuCategory[]): string {
  if (categoryId === 'uncat') return 'прочее'
  return categories.find((c) => c.id === categoryId)?.name ?? categoryId
}

/** Step 3: small badge for dish by goal (лайт / баланс / разнообразие). */
function getDishBadge(goal: GoalId | null, dish: Dish): string | null {
  if (!goal) return null
  const tags = dish.tags ?? []
  const cat = dish.categoryId
  if (goal === 'fit') {
    if (['3', '4'].includes(cat) || tags.some((t) => ['healthy', 'vegetarian', 'vegan'].includes(t))) return 'лайт'
    return null
  }
  if (goal === 'simple') {
    if (tags.some((t) => ['popular', 'hit'].includes(t))) return 'баланс'
    return null
  }
  if (goal === 'family') {
    if (tags.some((t) => ['chef-choice', 'new', 'popular'].includes(t))) return 'разнообразие'
    return null
  }
  return null
}

/** Nearest delivery label from selected weekdays. Wizard uses 0=Пн..6=Вс. */
function getNearestDeliveryLabel(selectedDays: number[], deliveryTime = '13:00'): string {
  if (selectedDays.length === 0) return 'ближайшая доставка —'
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const jsDay = new Date().getDay()
  const todayWizard = jsDay === 0 ? 6 : jsDay - 1
  let next = selectedDays.find((d) => d >= todayWizard)
  if (next == null) next = selectedDays[0]
  const dayLabel = weekdays[next]
  return `след. доставка: ${dayLabel} ${deliveryTime}`
}

export function SubscriptionWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const compositionId = searchParams.get('composition') || searchParams.get('edit') || ''
  const isEditMode = Boolean(compositionId)
  const addSubscription = useSubscriptionStore((state) => state.addSubscription)
  const updateSubscription = useSubscriptionStore((state) => state.updateSubscription)
  const [isCreating, setIsCreating] = useState(false)
  const createRequestIdRef = useRef<string | null>(null)

  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [dishes, setDishes] = useState<Dish[]>([])
  const [dishesLoading, setDishesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setDishesLoading(true)
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/categories', { cache: 'no-store' }),
          fetch('/api/dishes?subscriptionEligible=true', { cache: 'no-store' }),
        ])
        const cData = await cRes.json().catch(() => null)
        const dData = await dRes.json().catch(() => null)
        if (cancelled) return
        if (cRes.ok && Array.isArray(cData)) {
          setCategories(cData.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug ?? c.id })))
        }
        if (dRes.ok && Array.isArray(dData)) {
          setDishes(dData.map(mapDishFromApi))
        } else {
          setDishes([])
        }
      } catch {
        if (!cancelled) setDishes([])
      } finally {
        if (!cancelled) setDishesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([])
  const [plansReason, setPlansReason] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [buildMode, setBuildMode] = useState<SubscriptionBuildMode>('custom')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all')
  const [goal, setGoal] = useState<GoalId | null>(null)
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]) // Пн, Ср, Пт
  const [selectedDishes, setSelectedDishes] = useState<SelectedDish[]>([])
  /** Куда кладём блюда из меню: весь день (null) или приём пищи. */
  const [activeMealSlot, setActiveMealSlot] = useState<'all' | MealSlot>('all')
  const [subscriptionName, setSubscriptionName] = useState('')
  const [step, setStep] = useState<SubscriptionWizardStep>(SubscriptionWizardStep.SelectPlan)
  const [editLoaded, setEditLoaded] = useState(false)
  const [editError, setEditError] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const hasPlans = planTemplates.length > 0
  const dishPrefillDoneRef = useRef(false)
  /** Однократное авто-сворачивание шага «блюда» после валидного префилла готового тарифа. */
  const dishesAutoCollapsedForTemplateRef = useRef<string | null>(null)
  const [dishesDetailsOpen, setDishesDetailsOpen] = useState(true)
  const [subConfig, setSubConfig] = useState<SubscriptionConfig>(defaultSubscriptionConfig())
  const [subConfigLoaded, setSubConfigLoaded] = useState(false)
  const [personCount, setPersonCount] = useState(1)
  const [periodDays, setPeriodDays] = useState(28)
  const [liveQuote, setLiveQuote] = useState<{
    guestPrice: number
    periodRetail: number
    guestSavingsPercent: number
    deliveriesInPeriod: number
  } | null>(null)
  const [favoriteDishIds, setFavoriteDishIds] = useState<string[]>([])
  const [favoritesLoaded, setFavoritesLoaded] = useState(false)

  const isUnifiedCreate = !isEditMode
  const catalogActive = useMemo(
    () => subConfigLoaded && getEnabledMealSlots(subConfig).length > 0,
    [subConfigLoaded, subConfig]
  )

  useEffect(() => {
    let cancelled = false
    fetch('/api/subscriptions/config', {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...telegramInitHeaderRecord() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok || !data.enabled || !data.config) return
        const cfg = data.config as SubscriptionConfig
        setSubConfig(cfg)
        setPeriodDays(cfg.defaultPeriodDays ?? 28)
        setPersonCount(cfg.minPersons ?? 1)
        const slots = Array.isArray(data.enabledSlots) ? data.enabledSlots : getEnabledMealSlots(cfg)
        if (!isEditMode && slots.length) {
          const days = suggestDeliveryDays(cfg, slots)
          setSelectedDays(days)
          setDaysPerWeek(days.length)
        }
      })
      .finally(() => {
        if (!cancelled) setSubConfigLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [isEditMode])

  useEffect(() => {
    let cancelled = false
    fetch('/api/favorites', {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...telegramInitHeaderRecord() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok) return
        setFavoriteDishIds(Array.isArray(data.ids) ? data.ids.map(String) : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFavoritesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isEditMode || !subConfigLoaded || !favoritesLoaded || dishPrefillDoneRef.current) return
    if (buildMode !== 'custom' && selectedTemplateId) return
    const slots = getEnabledMealSlots(subConfig)
    if (!slots.length || !dishes.length) return
    const prefill = buildPrefillItems(
      subConfig,
      dishes.map((d) => ({ id: d.id, tags: d.tags })),
      {
        enabledSlots: slots,
        deliveryDays: selectedDays,
        personCount,
        periodDays,
        goal,
      },
      favoriteDishIds
    )
    if (!prefill.length) return
    dishPrefillDoneRef.current = true
    setSelectedDishes(
      prefill.map((p) => ({
        dishId: p.dishId,
        quantity: p.quantity,
        mealSlot: p.mealSlot ?? null,
        modifierIds: p.modifierIds ?? [],
      }))
    )
  }, [isEditMode, subConfigLoaded, favoritesLoaded, buildMode, selectedTemplateId, subConfig, dishes, selectedDays, personCount, periodDays, goal, favoriteDishIds])

  useEffect(() => {
    if (selectedDishes.length === 0) {
      setLiveQuote(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/subscriptions/quote', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
          body: JSON.stringify({
            items: selectedDishes.map((it) => ({
              dishId: it.dishId,
              quantity: it.quantity,
              mealSlot: it.mealSlot,
              modifierIds: it.modifierIds,
            })),
            deliveryDays: selectedDays.map((d) => normalizeWizardDayToJs(d)),
            periodDays,
            personCount,
          }),
        })
        const data = await res.json().catch(() => null)
        if (res.ok && data?.ok && data.quote) {
          setLiveQuote({
            guestPrice: data.quote.guestPrice,
            periodRetail: data.quote.periodRetail,
            guestSavingsPercent: data.quote.guestSavingsPercent,
            deliveriesInPeriod: data.quote.deliveriesInPeriod,
          })
        }
      } catch {
        setLiveQuote(null)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [selectedDishes, selectedDays, periodDays, personCount])

  const rationStripLines = useMemo(
    () =>
      selectedDishes.map((item) => {
        const d = dishes.find((x) => x.id === item.dishId)
        return {
          key: lineKey(item),
          dishId: item.dishId,
          quantity: item.quantity,
          image: d?.image,
          name: d?.name ?? item.dishId,
        }
      }),
    [selectedDishes, dishes]
  )

  const scrollToRationLine = (key: string) => {
    const item = selectedDishes.find((it) => lineKey(it) === key)
    if (!item) return
    setDishesDetailsOpen(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(rationRowElementId(item))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    })
  }

  useEffect(() => {
    if (planTemplates.length === 0) {
      setBuildMode('custom')
    }
  }, [planTemplates.length])

  useEffect(() => {
    dishPrefillDoneRef.current = false
    dishesAutoCollapsedForTemplateRef.current = null
  }, [selectedTemplateId])

  useEffect(() => {
    if (!isUnifiedCreate || buildMode !== 'from_plan' || !selectedTemplateId) {
      setDishesDetailsOpen(true)
    }
  }, [isUnifiedCreate, buildMode, selectedTemplateId])

  useEffect(() => {
    if (!compositionId) return
    let cancelled = false
    setEditError(false)
    ;(async () => {
      try {
        const res = await fetch(`/api/subscriptions/${compositionId}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord() },
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !data?.ok || !data.subscription) {
          setEditError(true)
          setEditLoaded(true)
          return
        }
        const sub = data.subscription
        setSubscriptionName(sub.name ?? '')
        const daysRaw = Array.isArray(sub.deliveryDays) ? sub.deliveryDays : [1, 3, 5]
        const days = ([...new Set(
            daysRaw
              .map((n: any) => Number(n))
              .filter((n: number) => Number.isFinite(n) && n >= 0 && n <= 6)
              .map((n: number) => normalizeJsDayToWizard(n))
          )] as number[]).sort((a, b) => a - b)
        setSelectedDays(days)
        setDaysPerWeek(days.length)
        const items = Array.isArray(sub.items) ? sub.items : []
        setSelectedDishes(
          items
            .map((it: any) => ({
              dishId: it.dishId ?? it.dish?.id ?? '',
              quantity: Math.max(1, Number(it?.quantity ?? 1)),
              mealSlot: parseMealSlot(it.mealSlot),
              modifierIds: normalizeModifierIds(it.modifierIds),
            }))
            .filter((i: { dishId: string }) => i.dishId)
        )
        setStep(SubscriptionWizardStep.AdjustDishesWithinLimits)
        setGoal('simple')
      } catch {
        if (!cancelled) setEditError(true)
      } finally {
        if (!cancelled) setEditLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [compositionId])

  useEffect(() => {
    let cancelled = false
    setPlansReason(null)
    fetch('/api/subscriptions/plans', {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...telegramInitHeaderRecord() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setPlansReason(data?.reason ?? null)
        if (!data?.ok || !Array.isArray(data.plans)) return
        setPlanTemplates(data.plans)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedTemplateId) {
      const t = planTemplates.find((p) => p.id === selectedTemplateId)
      if (t?.presetSlug === 'standard') setGoal('simple')
      else if (t?.presetSlug === 'fit') setGoal('fit')
      else if (t?.presetSlug === 'family') setGoal('family')
    }
  }, [selectedTemplateId, planTemplates])

  const currentStepIndex = WIZARD_STEPS_ORDER.indexOf(step)
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  const { allowedCategoryIdsSet, categoryLimitByCategoryId, minDays, maxDays, minDishesPerDelivery, maxDishesPerDelivery } = useMemo(() => {
    if (buildMode === 'custom' || !selectedTemplateId) {
      const rules = resolveMealSlotRules(subConfig)
      return {
        allowedCategoryIdsSet: new Set(categories.map((c) => c.id).concat(['uncat'])),
        categoryLimitByCategoryId: {} as Record<string, number>,
        minDays: subConfig.minDaysPerWeek,
        maxDays: subConfig.maxDaysPerWeek,
        minDishesPerDelivery: 1,
        maxDishesPerDelivery: Math.max(1, ...Array.from(rules.enabledSlots).map((s) => rules.maxItemsBySlot[s] ?? 1)),
      }
    }
    const selectedTemplate = selectedTemplateId ? planTemplates.find((t) => t.id === selectedTemplateId) : null
    let allowedIds = new Set<string>()
    let limits: Record<string, number> = {}
    let minD = 3
    let maxD = 7
    let minDish = 1
    let maxDish = 5
    if (selectedTemplate) {
      const r = selectedTemplate.rules
      if (r && Array.isArray(r.allowedCategoryIds)) {
        allowedIds = new Set(r.allowedCategoryIds)
        limits = r.categoryLimits && typeof r.categoryLimits === 'object' ? { ...r.categoryLimits } : {}
        minD = r.minDaysPerWeek ?? minD
        maxD = r.maxDaysPerWeek ?? maxD
        minDish = r.minDishesPerDelivery ?? minDish
        maxDish = r.maxDishesPerDelivery ?? maxDish
      } else {
        const preset = selectedTemplate.presetSlug ? getDefaultPlanBySlug(selectedTemplate.presetSlug) : null
        if (preset) {
          const slugs = preset.rules.allowedCategorySlugs
          categories.forEach((c) => {
            if (slugs.includes(c.slug)) allowedIds.add(c.id)
          })
          limits = Object.fromEntries(
            Object.entries(preset.rules.categoryLimits).map(([slug, n]) => {
              const cat = categories.find((c) => c.slug === slug)
              return cat ? [cat.id, n] : [slug, n]
            })
          )
          minD = preset.rules.minDaysPerWeek
          maxD = preset.rules.maxDaysPerWeek
          minDish = preset.rules.minDishesPerDelivery
          maxDish = preset.rules.maxDishesPerDelivery
        } else if (Array.isArray(selectedTemplate.allowedCategoryIds) && selectedTemplate.allowedCategoryIds.length > 0) {
          allowedIds = new Set(selectedTemplate.allowedCategoryIds)
          const cl = selectedTemplate.categoryLimits
          if (cl && typeof cl === 'object') {
            Object.entries(cl).forEach(([k, n]) => {
              const cat = categories.find((c) => c.id === k || c.slug === k)
              if (cat) limits[cat.id] = Number(n) || 1
            })
          }
          if (selectedTemplate.minDaysPerWeek != null) minD = selectedTemplate.minDaysPerWeek
          if (selectedTemplate.maxDaysPerWeek != null) maxD = selectedTemplate.maxDaysPerWeek
          if (selectedTemplate.minDishesPerDelivery != null) minDish = selectedTemplate.minDishesPerDelivery
          if (selectedTemplate.maxDishesPerDelivery != null) maxDish = selectedTemplate.maxDishesPerDelivery
        }
      }
    }
    if (allowedIds.size === 0) {
      categories.forEach((c) => allowedIds.add(c.id))
      allowedIds.add('uncat')
    }
    return {
      allowedCategoryIdsSet: allowedIds,
      categoryLimitByCategoryId: limits,
      minDays: minD,
      maxDays: maxD,
      minDishesPerDelivery: minDish,
      maxDishesPerDelivery: maxDish,
    }
  }, [categories, planTemplates, selectedTemplateId, buildMode, subConfig])

  const enabledMealSlots = useMemo(() => getEnabledMealSlots(subConfig), [subConfig])
  const mealSlotRules = useMemo(() => resolveMealSlotRules(subConfig), [subConfig])

  const dishesByCategory = useMemo(() => {
    const groups: Record<string, Dish[]> = { uncat: [] }
    categories.forEach((c) => {
      if (allowedCategoryIdsSet.has(c.id) || allowedCategoryIdsSet.has('uncat')) groups[c.id] = []
    })
    if (allowedCategoryIdsSet.has('uncat')) groups.uncat = []
    dishes.forEach((dish) => {
      const key = dish.categoryId && categories.some((c) => c.id === dish.categoryId) ? dish.categoryId : 'uncat'
      if (!allowedCategoryIdsSet.has(key) && !allowedCategoryIdsSet.has('uncat')) return
      if (!groups[key]) groups[key] = []
      groups[key].push(dish)
    })
    return groups
  }, [categories, dishes, allowedCategoryIdsSet])

  const categoryOrder = useMemo(() => {
    const ids = categories.map((c) => c.id)
    const hasUncat = dishes.some((d) => !d.categoryId || d.categoryId === 'uncat' || !ids.includes(d.categoryId))
    if (hasUncat && !ids.includes('uncat')) ids.push('uncat')
    return ids
  }, [categories, dishes])

  useEffect(() => {
    if (activeCategoryFilter === 'all') return
    const stillExists = categoryOrder.includes(activeCategoryFilter)
    if (!stillExists) setActiveCategoryFilter('all')
  }, [activeCategoryFilter, categoryOrder])

  const selectedCount = useMemo(() => {
    return selectedDishes.reduce((sum, item) => sum + item.quantity, 0)
  }, [selectedDishes])

  useEffect(() => {
    if (!isUnifiedCreate || buildMode !== 'from_plan' || !selectedTemplateId || dishesLoading) return
    if (dishesAutoCollapsedForTemplateRef.current === selectedTemplateId) return
    if (selectedDishes.length === 0) return
    if (selectedCount < minDishesPerDelivery || selectedCount > maxDishesPerDelivery) return
    dishesAutoCollapsedForTemplateRef.current = selectedTemplateId
    setDishesDetailsOpen(false)
  }, [
    isUnifiedCreate,
    buildMode,
    selectedTemplateId,
    dishesLoading,
    selectedDishes.length,
    selectedCount,
    minDishesPerDelivery,
    maxDishesPerDelivery,
  ])

  useEffect(() => {
    if (isEditMode || !selectedTemplateId || selectedDays.length < minDays) return
    if (dishPrefillDoneRef.current || selectedDishes.length > 0) return
    const template = planTemplates.find((t) => t.id === selectedTemplateId)
    if (!template) return
    const matrixRaw = (template.configuration as any)?.matrix
    if (Array.isArray(matrixRaw) && matrixRaw.length > 0) {
      const byKey = new Map<string, SelectedDish>()
      for (const row of matrixRaw as Array<{ cell?: string; dishId?: string; quantity?: number }>) {
        const dishId = typeof row?.dishId === 'string' ? row.dishId : ''
        if (!dishId) continue
        const cell = typeof row?.cell === 'string' ? row.cell : ''
        const slot = parseMealSlot(cell.split(':')[1])
        const qty = Math.max(1, Number(row?.quantity || 1))
        const key = `${dishId}|${slot ?? 'all'}`
        const prev = byKey.get(key)
        if (prev) prev.quantity += qty
        else byKey.set(key, { dishId, quantity: qty, mealSlot: slot, modifierIds: [] })
      }
      if (byKey.size > 0) {
        dishPrefillDoneRef.current = true
        setSelectedDishes(Array.from(byKey.values()))
        return
      }
    }
    const prefilled = getPrefilledDishesForPlan(
      template,
      categories.map((c) => ({ id: c.id, slug: c.slug })),
      dishes.map((d) => ({ id: d.id, categoryId: d.categoryId, tags: d.tags })),
      template.presetSlug ? getDefaultPlanBySlug(template.presetSlug)?.rules : undefined
    )
    if (!canEnterAdjustDishes(prefilled)) return
    dishPrefillDoneRef.current = true
    setSelectedDishes(
      prefilled.map((p) => ({ dishId: p.dishId, quantity: p.quantity, mealSlot: null, modifierIds: [] }))
    )
  }, [
    isEditMode,
    selectedTemplateId,
    selectedDays,
    minDays,
    planTemplates,
    categories,
    dishes,
    selectedDishes.length,
  ])

  // Калькуляция стоимости
  const subscriptionPrice = useMemo(() => {
    const dishesPerDelivery = selectedDishes.reduce((sum, item) => sum + item.quantity, 0)

    if (dishesPerDelivery === 0) {
      return {
        perDelivery: 0,
        perWeek: 0,
        perMonth: 0,
        dishesPerDelivery: 0,
        totalCalories: 0,
      }
    }

    const avgDishPrice =
      selectedDishes.reduce((sum, item) => {
        const dish = dishes.find((d) => d.id === item.dishId)
        const unit = lineUnitPrice(dish, item.modifierIds ?? [])
        return sum + unit * item.quantity
      }, 0) / dishesPerDelivery

    const weeklyPrice = avgDishPrice * dishesPerDelivery * daysPerWeek
    const monthlyPrice = (weeklyPrice * 4.33).toFixed(0)

    return {
      perDelivery: Math.round(avgDishPrice * dishesPerDelivery),
      perWeek: Math.round(weeklyPrice),
      perMonth: parseInt(monthlyPrice, 10),
      dishesPerDelivery,
      totalCalories: selectedDishes.reduce((sum, item) => {
        const dish = dishes.find((d) => d.id === item.dishId)
        return sum + (dish?.calories || 0) * item.quantity
      }, 0),
    }
  }, [selectedDishes, daysPerWeek, dishes])

  const slotForAdd: MealSlot | null = activeMealSlot === 'all' ? null : activeMealSlot

  const linesMatch = (a: MealSlot | null, b: MealSlot | null) => (a ?? null) === (b ?? null)

  /** «Простая» позиция без опций — скрываем из рекомендаций, если уже добавлена. */
  const hasPlainLineForSlot = (dishId: string, mealSlot: MealSlot | null) =>
    selectedDishes.some(
      (item) =>
        item.dishId === dishId &&
        linesMatch(item.mealSlot ?? null, mealSlot) &&
        (item.modifierIds?.length ?? 0) === 0
    )

  const selectedInCategory = (categoryId: string) => {
    return selectedDishes.filter((item) => {
      const dish = dishes.find((d) => d.id === item.dishId)
      return dish?.categoryId === categoryId
    })
  }

  const selectedQtyInCategory = (categoryId: string) =>
    selectedDishes.reduce((sum, item) => {
      const dish = dishes.find((d) => d.id === item.dishId)
      return dish?.categoryId === categoryId ? sum + item.quantity : sum
    }, 0)

  const getCategoryLimit = (categoryId: string) =>
    categoryLimitByCategoryId[categoryId] ?? 3

  const addDishFromMenu = (dishId: string) => {
    if (buildMode === 'from_plan' && selectedTemplateId && selectedTemplate?.planMode === 'READY') return
    const mealSlot = slotForAdd
    const newItem: SelectedDish = { dishId, quantity: 1, mealSlot, modifierIds: [] }
    setSelectedDishes((prev) => {
      if (prev.some((item) => lineKey(item) === lineKey(newItem))) {
        toast.error('уже в рационе — измените количество или откройте варианты ниже')
        return prev
      }

      const dish = dishes.find((d) => d.id === dishId)
      const categoryId = dish?.categoryId ?? 'uncat'
      const inCat = prev.filter((item) => {
        const d = dishes.find((x) => x.id === item.dishId)
        return (d?.categoryId ?? 'uncat') === categoryId
      })
      const limit = getCategoryLimit(categoryId)
      const inCatQty = inCat.reduce((sum, item) => sum + item.quantity, 0)
      if (inCatQty >= limit) {
        toast.error(`в этой категории можно выбрать до ${limit} позиций`)
        return prev
      }
      const total = prev.reduce((s, i) => s + i.quantity, 0)
      if (total >= maxDishesPerDelivery) {
        toast.error(`на одну доставку — до ${maxDishesPerDelivery} блюд`)
        return prev
      }
      return [...prev, newItem]
    })
  }

  const setLineModifierIds = (target: SelectedDish, nextRaw: string[]) => {
    const nextModifierIds = normalizeModifierIds(nextRaw)
    setSelectedDishes((prev) => {
      const k = lineKey(target)
      const merged: SelectedDish = { ...target, modifierIds: nextModifierIds }
      const nk = lineKey(merged)
      if (nk !== k && prev.some((x) => lineKey(x) === nk)) {
        toast.error('такой вариант уже есть в рационе')
        return prev
      }
      return prev.map((x) => (lineKey(x) === k ? { ...x, modifierIds: nextModifierIds } : x))
    })
  }

  const removeLine = (target: SelectedDish) => {
    if (buildMode === 'from_plan' && selectedTemplateId && selectedTemplate?.planMode === 'READY') return
    setSelectedDishes((prev) => prev.filter((item) => lineKey(item) !== lineKey(target)))
  }

  const updateDishQuantity = (target: SelectedDish, delta: number) => {
    if (buildMode === 'from_plan' && selectedTemplateId && selectedTemplate?.planMode === 'READY') return
    const k = lineKey(target)
    setSelectedDishes((prev) => {
      const totalWithout = prev.reduce((s, i) => s + (lineKey(i) === k ? 0 : i.quantity), 0)
      const targetDish = dishes.find((d) => d.id === target.dishId)
      const categoryId = targetDish?.categoryId ?? 'uncat'
      const categoryWithout = prev.reduce((sum, item) => {
        if (lineKey(item) === k) return sum
        const d = dishes.find((x) => x.id === item.dishId)
        return (d?.categoryId ?? 'uncat') === categoryId ? sum + item.quantity : sum
      }, 0)
      const categoryLimit = getCategoryLimit(categoryId)
      return prev.map((item) => {
        if (lineKey(item) !== k) return item
        const newQty = Math.max(
          1,
          Math.min(maxDishesPerDelivery - totalWithout, categoryLimit - categoryWithout, item.quantity + delta)
        )
        return { ...item, quantity: newQty }
      })
    })
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        const filtered = prev.filter((d) => d !== day)
        if (filtered.length < minDays) return prev
        setDaysPerWeek(filtered.length)
        return filtered
      }
      const next = [...prev, day].sort((a, b) => a - b)
      if (next.length > maxDays) return prev
      setDaysPerWeek(next.length)
      return next
    })
  }

  const applyDaysPerWeek = (value: number) => {
    const v = Math.max(minDays, Math.min(maxDays, value))
    setDaysPerWeek(v)

    // подгоняем выбранные дни под значение слайдера (простая и предсказуемая логика)
    setSelectedDays((prev) => {
      if (prev.length === v) return prev
      if (prev.length > v) return prev.slice(0, v)

      const set = new Set(prev)
      for (let d = 0; d < 7 && set.size < v; d++) set.add(d)
      return Array.from(set).sort((a, b) => a - b)
    })
  }

  const validate = () => {
    if (!isEditMode && buildMode === 'from_plan' && !hasPlans) {
      toast.error('готовых тарифов пока нет — переключись на «свой рацион»')
      return false
    }
    if (!isEditMode && hasPlans && buildMode === 'from_plan' && !selectedTemplateId) {
      toast.error('выбери план или переключись на «свой рацион»')
      return false
    }
    if (selectedDays.length < minDays) {
      toast.error(`выбери минимум ${minDays} дней доставки`)
      return false
    }
    if (selectedDays.length > maxDays) {
      toast.error(`максимум ${maxDays} дней в неделю`)
      return false
    }
    if (selectedDishes.length === 0) {
      toast.error('выбери хотя бы одно блюдо')
      return false
    }
    if (!subscriptionName.trim() && !isEditMode) {
      toast.error('введи название подписки')
      return false
    }
    return true
  }

  const selectedTemplate = selectedTemplateId ? planTemplates.find((t) => t.id === selectedTemplateId) : null
  const hardOptionIds = templateHardOptionIds(selectedTemplate ?? null)
  const effectivePlan: SubscriptionPlan = selectedTemplate?.plan ?? (daysPerWeek >= 6 ? 'WEEKLY' : daysPerWeek >= 4 ? 'BIWEEKLY' : 'MONTHLY')
  const effectivePriceForPeriod =
    liveQuote?.guestPrice ??
    (selectedTemplate
      ? selectedTemplate.pricingMode === 'MENU'
        ? subscriptionPrice.perMonth
        : selectedTemplate.pricingMode === 'MENU_DISCOUNT'
          ? Math.round(subscriptionPrice.perMonth * (1 - Math.max(0, Math.min(90, Number(selectedTemplate.menuDiscountPercent || 0))) / 100))
          : selectedTemplate.plan === 'MONTHLY'
            ? selectedTemplate.price
            : selectedTemplate.plan === 'BIWEEKLY'
              ? selectedTemplate.price * 2.165
              : selectedTemplate.price * 4.33
      : subscriptionPrice.perMonth)
  const effectivePricePerMonth = effectivePriceForPeriod

  const onCreate = async () => {
    if (isCreating) return
    if (!validate()) return
    setCreateError(null)
    setIsCreating(true)

    const plan: SubscriptionPlan = effectivePlan

    const subscriptionItems = selectedDishes
      .map((item) => {
        const dish = dishes.find((d) => d.id === item.dishId)
        if (!dish) return null
        const slotKey = item.mealSlot ?? 'any'
        const modKey = normalizeModifierIds(item.modifierIds).join('-') || 'base'
        return {
          id: `item_${Date.now()}_${item.dishId}_${slotKey}_${modKey}`,
          dishId: item.dishId,
          quantity: item.quantity,
          mealSlot: item.mealSlot,
          modifierIds: item.modifierIds,
          dish: dish,
        }
      })
      .filter(Boolean) as any[]

    const readyMatrixRaw = (selectedTemplate?.configuration as any)?.matrix
    const readyItemsPayload =
      buildMode === 'from_plan' &&
      selectedTemplate?.planMode === 'READY' &&
      Array.isArray(readyMatrixRaw)
        ? readyMatrixRaw
            .map((row: { cell?: string; dishId?: string; quantity?: number }) => {
              const dishId = typeof row?.dishId === 'string' ? row.dishId : ''
              const qty = Math.max(1, Number(row?.quantity || 1))
              const cell = typeof row?.cell === 'string' ? row.cell : ''
              const [dayStr, slotStr] = cell.split(':')
              const cycleDay = Number(dayStr || 1)
              const wizardDay = Number.isFinite(cycleDay) ? ((Math.max(1, cycleDay) - 1) % 7) : 0
              const mealSlot = parseMealSlot(slotStr)
              if (!dishId) return null
              return {
                dishId,
                quantity: qty,
                dayOfWeek: wizardDay,
                ...(mealSlot ? { mealSlot } : {}),
              }
            })
            .filter(Boolean)
        : []

    const itemsPayload = (readyItemsPayload.length > 0 ? readyItemsPayload : selectedDishes.map((it) => ({
      dishId: it.dishId,
      quantity: it.quantity,
      ...(it.mealSlot ? { mealSlot: it.mealSlot } : {}),
      ...(it.modifierIds?.length ? { modifierIds: it.modifierIds } : {}),
    }))) as Array<Record<string, unknown>>

    try {
      if (isEditMode && compositionId) {
        const res = await fetch(`/api/subscriptions/${compositionId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
          body: JSON.stringify({
            items: itemsPayload,
            ...(selectedDays.length > 0 && { deliveryDays: selectedDays.map((d) => normalizeWizardDayToJs(d)) }),
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          toast.error(data?.error || 'не удалось сохранить состав')
          setIsCreating(false)
          return
        }
        updateSubscription(compositionId, {
          items: subscriptionItems,
          deliveryDays: selectedDays,
        } as any)
        toast.success('состав обновлён')
      } else {
        const clientRequestId =
          createRequestIdRef.current ??
          (createRequestIdRef.current =
            (globalThis as any)?.crypto?.randomUUID?.() ? (globalThis as any).crypto.randomUUID() : String(Date.now()))
        const res = await fetch('/api/subscriptions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
          body: JSON.stringify({
            clientRequestId,
            name: subscriptionName.trim(),
            plan,
            planTemplateId:
              buildMode === 'from_plan' && selectedTemplateId ? selectedTemplateId : undefined,
            price: Math.round(effectivePriceForPeriod),
            personCount,
            periodDays,
            deliveryDays: selectedDays.map((d) => normalizeWizardDayToJs(d)),
            deliveryTime: '13:00',
            startDate: new Date().toISOString(),
            nextDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            items: subscriptionItems.map((it) => ({
              dishId: it.dishId,
              quantity: it.quantity,
              name: it.dish?.name,
              ...(it.mealSlot ? { mealSlot: it.mealSlot } : {}),
              ...(it.modifierIds?.length ? { modifierIds: it.modifierIds } : {}),
            })),
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          const errMsg =
            data?.error ||
            data?.message ||
            (res.status === 401 ? 'Войдите через Telegram (откройте приложение из бота).' : `не удалось создать подписку (${res.status})`)
          setCreateError(errMsg)
          toast.error(errMsg)
          setIsCreating(false)
          return
        }
        const serverSubscriptionId = typeof data?.subscriptionId === 'string' ? data.subscriptionId : undefined
        addSubscription({
          ...(serverSubscriptionId ? { id: serverSubscriptionId } : {}),
          name: subscriptionName.trim(),
          plan,
          status: 'ACTIVE' as SubscriptionStatus,
          price: Math.round(effectivePricePerMonth),
          deliveryDays: selectedDays,
          deliveryTime: '13:00',
          startDate: new Date(),
          nextDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000),
          items: subscriptionItems,
        } as any)
        toast.success('подписка создана')
      }
      router.push(isEditMode && compositionId ? `/subscriptions/${compositionId}` : '/subscriptions')
    } catch (e: any) {
      const msg = e?.message || (isEditMode ? 'не удалось сохранить' : 'не удалось отправить подписку на сервер')
      setCreateError(msg)
      toast.error(msg)
    } finally {
      setIsCreating(false)
    }
  }

  const deliveriesPerMonth = liveQuote?.deliveriesInPeriod ?? Math.round(selectedDays.length * 4.33)
  const canGoNext = () => {
    if (step === SubscriptionWizardStep.SelectPlan) {
      if (isEditMode) return true
      if (planTemplates.length === 0) return true
      if (buildMode === 'custom') return true
      return !!selectedTemplateId
    }
    if (step === SubscriptionWizardStep.SelectDays) return selectedDays.length >= minDays
    if (step === SubscriptionWizardStep.AdjustDishesWithinLimits) {
      return selectedCount >= minDishesPerDelivery && selectedCount <= maxDishesPerDelivery
    }
    return true
  }
  const goNext = () => {
    const next = getNextStep(step)
    if (next && canGoNext()) setStep(next)
  }
  const goBack = () => {
    const prev = getPrevStep(step)
    if (prev) setStep(prev)
  }

  const cardClass = 'ui-surface-card'
  const summaryBarStep = isUnifiedCreate
    ? selectedCount > 0
      ? SubscriptionWizardStep.AdjustDishesWithinLimits
      : SubscriptionWizardStep.SelectDays
    : step

  if (isEditMode && !editLoaded) {
    return (
      <div className="flex flex-col">
        <PageHeader
          backHref={compositionId ? `/subscriptions/${compositionId}` : '/subscriptions'}
          title="изменить состав"
          subtitle="загрузка…"
        />
        <div
          className="mt-6 overflow-hidden border border-black/[0.06] bg-[color:var(--surface)] p-6"
          style={{ borderRadius: 'var(--radius-large)' }}
        >
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-3/4 rounded bg-black/10" />
            <div className="h-4 w-1/2 rounded bg-black/10" />
            <div className="h-20 rounded bg-black/10" />
          </div>
        </div>
      </div>
    )
  }

  if (isEditMode && editError) {
    return (
      <div className="flex flex-col">
        <PageHeader backHref="/subscriptions" title="изменить состав" subtitle="ошибка" />
        <div
          className="mt-6 overflow-hidden border border-black/[0.06] bg-[color:var(--surface)] p-6 text-center"
          style={{ borderRadius: 'var(--radius-large)' }}
        >
          <p className="ui-body">Не удалось загрузить подписку.</p>
          <Link
            href={compositionId ? `/subscriptions/${compositionId}` : '/subscriptions'}
            prefetch={false}
            className="btn btn-soft mt-3 inline-flex rounded-full px-4 py-2"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            назад
          </Link>
        </div>
      </div>
    )
  }

  const unifiedBottomPad =
    'pb-[calc(var(--ufo-bottomnav-h,72px)+env(safe-area-inset-bottom)+12.5rem)]'

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', isUnifiedCreate && unifiedBottomPad)}>
      {isEditMode ? (
        <PageHeader
          backHref={compositionId ? `/subscriptions/${compositionId}` : '/subscriptions'}
          title="изменить состав"
        />
      ) : (
        <PageHeader backHref="/subscriptions" title="создать подписку" compact className="mb-1" />
      )}
      {isEditMode ? (
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="ui-h2 text-[16px]">состав подписки</h2>
          <span className="ui-muted shrink-0 text-[12px] font-medium">редактирование</span>
        </div>
      ) : null}
      {isEditMode ? (
        <div
          className="mb-4 h-1 w-full shrink-0 overflow-hidden rounded-full bg-black/[0.06]"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          <div
            className="h-full bg-[color:var(--primary)] transition-[width] duration-300"
            style={{
              width: `${((currentStepIndex + 1) / WIZARD_STEPS_ORDER.length) * 100}%`,
              borderRadius: 'var(--radius-pill)',
            }}
          />
        </div>
      ) : null}

      {/* Step 1: режим + (если есть) готовые тарифы */}
      {(isUnifiedCreate || step === SubscriptionWizardStep.SelectPlan) && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <details open className={`${cardClass} group`}>
            <summary className="cursor-pointer list-none text-[14px] font-extrabold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex w-full items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <IconCard className="h-[18px] w-[18px] text-[color:var(--muted)]" />
                  <span>формат подписки</span>
                </span>
                <IconChevronDown className="h-[16px] w-[16px] text-[color:var(--muted)]" />
              </span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-[color:var(--stroke)] pt-3">
              {catalogActive && buildMode === 'custom' ? (
                <p className="ui-muted text-[13px]">
                  Рацион из каталога заведения: слоты {getEnabledMealSlots(subConfig).map((s) => MEAL_SLOT_LABEL[s]).join(', ')}.
                  Состав ниже можно править в рамках лимитов.
                </p>
              ) : null}
              {hasPlans ? (
                <details open={!catalogActive && buildMode === 'from_plan'} className="rounded-xl border border-[color:var(--stroke)] p-3">
                  <summary className="cursor-pointer text-[13px] font-semibold text-[color:var(--text)]">
                    {catalogActive ? 'готовые рационы (опционально)' : 'выбор формата'}
                  </summary>
                  <div className="mt-3 space-y-3">
              <div
                className="grid grid-cols-2 rounded-full border p-1"
                style={{ borderColor: 'var(--stroke)', borderRadius: 'var(--radius-pill)', background: 'var(--surface)' }}
              >
                <button
                  type="button"
                  onClick={() => setBuildMode('from_plan')}
                  className={cn(
                    'rounded-full px-3 py-2 text-[13px] font-semibold transition',
                    buildMode === 'from_plan'
                      ? 'bg-[color:var(--primary)] text-white'
                      : 'bg-transparent text-[color:var(--muted)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  готовый рацион
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBuildMode('custom')
                    setSelectedTemplateId(null)
                  }}
                  className={cn(
                    'rounded-full px-3 py-2 text-[13px] font-semibold transition',
                    buildMode === 'custom'
                      ? 'bg-[color:var(--primary)] text-white'
                      : 'bg-transparent text-[color:var(--muted)]'
                  )}
                  style={{ borderRadius: 'var(--radius-pill)' }}
                >
                  свой рацион
                </button>
              </div>
              {buildMode === 'from_plan' ? (
                hasPlans ? (
                  <div
                    className="flex gap-3 overflow-x-auto px-1 py-1"
                    style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
                  >
                    {planTemplates.map((t) => {
                      const isSelected = selectedTemplateId === t.id
                      const desc = t.description || (t.presetSlug ? getDefaultPlanBySlug(t.presetSlug)?.description : null)
                      const cover = typeof t.coverImageUrl === 'string' ? t.coverImageUrl.trim() : ''
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTemplateId(null)
                              setBuildMode('custom')
                            } else {
                              setBuildMode('from_plan')
                              setSelectedTemplateId(t.id)
                            }
                          }}
                          className={cn(
                            'box-border flex w-[280px] flex-shrink-0 flex-col overflow-hidden text-left outline-none transition-[border-color,box-shadow] duration-200 active:scale-[0.99]',
                            isSelected
                              ? 'border-2 border-[color:var(--primary)] shadow-[var(--shadow-soft)]'
                              : 'border-2 border-[color:var(--stroke)] hover:border-[color:var(--primary)]/45'
                          )}
                          style={{
                            borderRadius: 'var(--radius-large)',
                            scrollSnapAlign: 'start',
                            background: 'var(--surface-strong)',
                          }}
                        >
                          <div className="relative h-[104px] w-full shrink-0 overflow-hidden">
                            {cover ? (
                              <OptimizedImage
                                src={cover}
                                alt=""
                                className="object-cover"
                                sizes="280px"
                                quality={82}
                              />
                            ) : (
                              <div
                                className="h-full w-full"
                                style={{ background: subscriptionPlanPresetGradient(t.presetSlug) }}
                              />
                            )}
                            {isSelected ? (
                              <span
                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)] text-[14px] font-bold text-white shadow-md"
                                style={{ borderRadius: 'var(--radius-pill)' }}
                                aria-hidden
                              >
                                ✓
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <h3 className="text-[17px] font-extrabold leading-tight tracking-tight" style={{ color: 'var(--text)' }}>
                                {t.name}
                              </h3>
                              {desc ? (
                                <p className="mt-1.5 line-clamp-2 text-[13px]" style={{ color: 'var(--muted)' }}>
                                  {desc}
                                </p>
                              ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--stroke)] pt-3">
                              <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                                {formatPrice(t.price)}
                              </span>
                              <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
                                / {PLAN_LABEL[t.plan]}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="ui-muted text-[13px]">
                    {plansReason === 'subscription_disabled'
                      ? 'Подписки выключены в настройках заведения.'
                      : 'Готовых рационов пока нет — переключись на «свой рацион».'
                    }
                  </p>
                )
              ) : (
                <p className="ui-muted text-[13px]">
                  Соберите свой рацион: дни, блюда и опции сформируют карточку подписки ниже.
                </p>
              )}
                  </div>
                </details>
              ) : !catalogActive ? (
                <p className="ui-muted text-[13px]">
                  Соберите свой рацион: дни, блюда и опции сформируют карточку подписки ниже.
                </p>
              ) : null}
            </div>
          </details>
          {!isUnifiedCreate ? (
            <button
              type="button"
              onClick={goNext}
              disabled={(hasPlans && buildMode === 'from_plan' && !selectedTemplateId) || (!hasPlans && buildMode === 'from_plan')}
              className="btn btn-primary mt-auto w-full shrink-0 rounded-full py-3 text-[14px] font-semibold disabled:opacity-50"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              дальше
            </button>
          ) : null}
        </div>
      )}

      {/* Step 2: расписание — блок как в чекауте */}
      {(isEditMode || hasPlans || buildMode === 'custom') && (isUnifiedCreate || step === SubscriptionWizardStep.SelectDays) && (
        <div className={cn('flex min-h-0 flex-1 flex-col gap-4', !isUnifiedCreate && 'pb-28')}>
          <details open className={cardClass}>
            <summary className="cursor-pointer list-none text-[14px] font-extrabold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex w-full items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2">
                  <IconMapPin className="h-[18px] w-[18px] text-[color:var(--muted)]" />
                  <span>доставка · 13:00</span>
                </span>
                <IconChevronDown className="h-[16px] w-[16px] text-[color:var(--muted)]" />
              </span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-[color:var(--stroke)] pt-3">
            <div className="grid grid-cols-7 gap-1.5">
              {weekdays.map((label, idx) => {
                const isSelected = selectedDays.includes(idx)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    title={`${label}${maxDays < 7 ? ` · ${minDays}–${maxDays}` : ''}`}
                    className="flex aspect-square max-h-11 items-center justify-center rounded-full text-[12px] font-semibold transition-all duration-200 active:scale-[0.96]"
                    style={{
                      borderRadius: 'var(--radius-pill)',
                      background: isSelected ? 'var(--text)' : 'transparent',
                      color: isSelected ? 'var(--surface)' : 'var(--text)',
                      border: isSelected ? '1px solid var(--text)' : '1px solid var(--stroke)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px]">
                <span className="font-semibold text-[color:var(--muted)]">персон</span>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-soft h-9 w-9 rounded-full text-[16px]"
                    onClick={() => setPersonCount((n) => Math.max(subConfig.minPersons, n - 1))}
                  >
                    −
                  </button>
                  <span className="min-w-[2ch] text-center text-[15px] font-bold tabular-nums">{personCount}</span>
                  <button
                    type="button"
                    className="btn btn-soft h-9 w-9 rounded-full text-[16px]"
                    onClick={() => setPersonCount((n) => Math.min(subConfig.maxPersons, n + 1))}
                  >
                    +
                  </button>
                </div>
              </label>
              <label className="block text-[12px]">
                <span className="font-semibold text-[color:var(--muted)]">период</span>
                <select
                  value={periodDays}
                  onChange={(e) => setPeriodDays(Number(e.target.value))}
                  className="input mt-1 w-full rounded-lg px-3 py-2 text-[13px]"
                >
                  {(subConfig.availablePeriods ?? [7, 14, 28]).map((d) => (
                    <option key={d} value={d}>{d} дней</option>
                  ))}
                </select>
              </label>
            </div>
            {enabledMealSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {enabledMealSlots.map((slot) => (
                  <span
                    key={slot}
                    className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold capitalize"
                    style={{ borderRadius: 'var(--radius-pill)' }}
                  >
                    {MEAL_SLOT_LABEL[slot]}
                  </span>
                ))}
              </div>
            ) : null}
            <div
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 text-[12px] tabular-nums"
              style={{
                background: 'color-mix(in srgb, var(--surface-strong) 88%, transparent)',
                borderRadius: 'var(--radius-medium)',
                border: '1px solid var(--stroke)',
              }}
            >
              <span className="text-[color:var(--muted)]">
                <span className="font-semibold text-[color:var(--text)]">{selectedDays.length}</span>
                <span className="opacity-80">/{maxDays}</span>
                <span className="ml-1">в нед</span>
              </span>
              <span className="text-[color:var(--muted)]">
                ~<span className="font-semibold text-[color:var(--text)]">{deliveriesPerMonth}</span>
                <span className="ml-1">дост/мес</span>
              </span>
              {selectedTemplate ? (
                <span className="font-semibold text-[color:var(--text)]">
                  {formatPrice(selectedTemplate.price)}
                  <span className="text-[11px] font-normal text-[color:var(--muted)]">/{PLAN_LABEL[selectedTemplate.plan]}</span>
                </span>
              ) : null}
            </div>
            </div>
          </details>
          {!isUnifiedCreate ? (
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={goBack} className="ui-back-button shrink-0" aria-label="назад">
                <IconChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={selectedDays.length < minDays}
                className="btn btn-primary flex-1 rounded-full py-3 disabled:opacity-50 transition-all duration-200"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                дальше
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Step 3: блюда — превью как в корзине */}
      {(isEditMode || hasPlans || buildMode === 'custom') && (isUnifiedCreate || step === SubscriptionWizardStep.AdjustDishesWithinLimits) && (
        <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto', !isUnifiedCreate && 'pb-28')}>
          {rationStripLines.length > 0 ? (
            <div className={cn(cardClass, 'space-y-2 py-3')}>
              <SubscriptionRationStrip lines={rationStripLines} onSelectLine={scrollToRationLine} />
              {isUnifiedCreate && !dishesDetailsOpen ? (
                <button
                  type="button"
                  onClick={() => setDishesDetailsOpen(true)}
                  className="text-[12px] font-semibold text-[color:var(--primary)] underline-offset-2 hover:underline"
                >
                  править состав
                </button>
              ) : null}
            </div>
          ) : null}
          <details
            className={cardClass}
            open={isUnifiedCreate ? dishesDetailsOpen : true}
            onToggle={(e) => {
              if (!isUnifiedCreate) return
              setDishesDetailsOpen(e.currentTarget.open)
            }}
          >
            <summary className="cursor-pointer list-none text-[14px] font-extrabold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex w-full items-center justify-between gap-2">
                <span className="inline-flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="inline-flex items-center gap-2">
                    <IconCart className="h-[18px] w-[18px] shrink-0 text-[color:var(--muted)]" />
                    <span>блюда</span>
                  </span>
                  {isUnifiedCreate && !dishesDetailsOpen && selectedCount > 0 ? (
                    <span className="text-[12px] font-medium text-[color:var(--muted)]">
                      {selectedCount} {buildMode === 'from_plan' && selectedTemplateId ? '· по плану' : ''}
                    </span>
                  ) : null}
                </span>
                <IconChevronDown className="h-[16px] w-[16px] text-[color:var(--muted)]" />
              </span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-[color:var(--stroke)] pt-3">
            {dishesLoading ? (
              <p className="ui-muted text-[13px]">меню…</p>
            ) : dishes.length === 0 ? (
              <p className="ui-muted text-[13px]">меню пустое</p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-semibold text-[color:var(--text)]">категории</div>
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>фильтр</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCategoryFilter('all')}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[12px] font-semibold',
                        activeCategoryFilter === 'all'
                          ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
                          : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--text)]'
                      )}
                      style={{ borderRadius: 'var(--radius-pill)' }}
                    >
                      все
                    </button>
                    {categoryOrder.map((categoryId) => {
                      const title = categoryTitle(categoryId, categories)
                      const catItems = dishesByCategory[categoryId] || []
                      return (
                        <button
                          key={`sub-filter-cat-${categoryId}`}
                          type="button"
                          onClick={() => setActiveCategoryFilter(categoryId)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-[12px] font-semibold',
                            activeCategoryFilter === categoryId
                              ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
                              : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--text)]'
                          )}
                          style={{ borderRadius: 'var(--radius-pill)' }}
                        >
                          {title} ({catItems.length})
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMealSlot('all')}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.98]',
                      activeMealSlot === 'all'
                        ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                        : 'border border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]'
                    )}
                    style={{ borderRadius: 'var(--radius-pill)' }}
                  >
                    весь день
                  </button>
                  {MEAL_SLOT_IDS.map((sid) => (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => setActiveMealSlot(sid)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.98]',
                        activeMealSlot === sid
                          ? 'bg-[color:var(--text)] text-[color:var(--surface)]'
                          : 'border border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--muted)]'
                      )}
                      style={{ borderRadius: 'var(--radius-pill)' }}
                    >
                      {MEAL_SLOT_LABEL[sid]}
                    </button>
                  ))}
                </div>
                <div className="space-y-8">
                  {categoryOrder.map((categoryId) => {
                    if (activeCategoryFilter !== 'all' && activeCategoryFilter !== categoryId) return null
                    const catDishes = dishesByCategory[categoryId]
                    if (!catDishes?.length) return null
                    const title = categoryTitle(categoryId, categories)
                    const inCat = selectedInCategory(categoryId)
                    const unselected = catDishes.filter((d) => !hasPlainLineForSlot(d.id, slotForAdd))
                    const recommendations = unselected.slice(0, 3)
                    return (
                      <div key={categoryId} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="ui-h2 text-[14px]">{title}</span>
                          <span className="ui-muted text-[12px]">
                            {selectedQtyInCategory(categoryId)}/{getCategoryLimit(categoryId)}
                          </span>
                        </div>
                        <div
                          className="rounded-xl overflow-hidden transition-all duration-200"
                          style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-medium)', border: '1px solid rgba(0,0,0,0.05)' }}
                        >
                          {inCat.length === 0 ? (
                            <div className="px-4 py-3 text-center">
                              <span className="text-[20px] leading-none text-[color:var(--muted)] opacity-40">+</span>
                            </div>
                          ) : (
                            inCat.map((item) => {
                              const dish = dishes.find((d) => d.id === item.dishId)
                              if (!dish) return null
                              const ms = item.mealSlot ?? null
                              const slotLabel = ms ? MEAL_SLOT_LABEL[ms] : 'весь день'
                              const badge = getDishBadge(goal, dish)
                              return (
                                <div
                                  key={lineKey(item)}
                                  id={rationRowElementId(item)}
                                  className="border-t border-[color:var(--stroke)] scroll-mt-24 px-4 py-3 first:border-t-0"
                                >
                                  <div className="flex min-h-[44px] items-center justify-between gap-3">
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                      <span className="ui-body truncate font-semibold">{dish.name}</span>
                                      <span
                                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]"
                                        style={{
                                          background: 'color-mix(in srgb, var(--text) 8%, transparent)',
                                          borderRadius: 'var(--radius-small)',
                                        }}
                                      >
                                        {slotLabel}
                                      </span>
                                      {dish.calories != null && (
                                        <span className="ui-muted shrink-0 text-[12px]">{dish.calories} ккал</span>
                                      )}
                                      {badge && (
                                        <span
                                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted)]"
                                          style={{
                                            background: 'color-mix(in srgb, var(--text) 6%, transparent)',
                                            borderRadius: 'var(--radius-small)',
                                          }}
                                        >
                                          {badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <InlineCounter
                                        value={item.quantity}
                                        onDec={() => updateDishQuantity(item, -1)}
                                        onInc={() => updateDishQuantity(item, 1)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeLine(item)}
                                        className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
                                        aria-label="убрать из рациона"
                                      >
                                        <IconPencil className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <SubscriptionDishOptionsPanel
                                    dish={dish}
                                    modifierIds={item.modifierIds ?? []}
                                    allowedOptionIds={hardOptionIds}
                                    onChange={(ids) => setLineModifierIds(item, ids)}
                                  />
                                </div>
                              )
                            })
                          )}
                    </div>
                    {!(buildMode === 'from_plan' && selectedTemplateId && selectedTemplate?.planMode === 'READY') && recommendations.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {recommendations.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => addDishFromMenu(d.id)}
                            className="inline-flex max-w-[200px] items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-[12px] font-medium text-black/55 transition active:scale-[0.98]"
                            style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(0,0,0,0.06)' }}
                          >
                            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-black/[0.06]">
                              {d.image ? (
                                <OptimizedImage src={d.image} alt="" className="object-cover" sizes="32px" />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--muted)]">
                                  <IconPlus className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </span>
                            <span className="truncate">{d.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
              </>
            )}
            </div>
          </details>
          {!isUnifiedCreate ? (
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={goBack} className="ui-back-button shrink-0" aria-label="назад">
                <IconChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={
                  dishesLoading ||
                  dishes.length === 0 ||
                  selectedCount < minDishesPerDelivery ||
                  selectedCount > maxDishesPerDelivery
                }
                className="btn btn-primary flex-1 rounded-full py-3 disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                дальше
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Резюме + имя + оформление (единая страница при создании или шаг подтверждения при правке) */}
      {(isEditMode || hasPlans || buildMode === 'custom') && (isUnifiedCreate || step === SubscriptionWizardStep.ReviewAndConfirm) && (
        <>
          <div className={cn(!isUnifiedCreate && 'pb-28')}>
            <details open className={cardClass}>
              <summary className="mb-3 cursor-pointer list-none text-[14px] font-extrabold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                <span className="inline-flex w-full items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <IconBell className="h-[18px] w-[18px] text-[color:var(--muted)]" />
                    <span>итог</span>
                  </span>
                  <IconChevronDown className="h-[16px] w-[16px] text-[color:var(--muted)]" />
                </span>
              </summary>
              <div className="space-y-3 border-t border-[color:var(--stroke)] pt-3">
              {subscriptionPrice.dishesPerDelivery > 0 ? (
                <div className="space-y-3">
                  <div
                    className="rounded-2xl px-3 py-2 text-[13px] font-medium"
                    style={{ background: 'color-mix(in srgb, var(--text) 6%, transparent)', borderRadius: 'var(--radius-medium)' }}
                  >
                    {getNearestDeliveryLabel(selectedDays, '13:00')}
                  </div>
                  <SubscriptionRationStrip lines={rationStripLines} dense />
                  <div className="flex justify-between gap-4 text-[12px] text-[color:var(--muted)]">
                    {subscriptionPrice.totalCalories > 0 ? (
                      <span>~{subscriptionPrice.totalCalories} ккал</span>
                    ) : (
                      <span />
                    )}
                    <span className="tabular-nums">
                      {selectedDays.length} дн · ~{deliveriesPerMonth}
                    </span>
                  </div>
                  <ul className="max-h-[160px] space-y-1 overflow-y-auto border-t border-[color:var(--stroke)] pt-2 text-[12px]">
                    {selectedDishes.map((item) => {
                      const d = dishes.find((x) => x.id === item.dishId)
                      if (!d) return null
                      const modHint = modifierLabelsForDish(d, item.modifierIds ?? [])
                      return (
                        <li key={lineKey(item)} className="space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--text)]">
                              {d.name} ×{item.quantity}
                            </span>
                            <span className="shrink-0 text-[color:var(--muted)]">
                              {item.mealSlot ? MEAL_SLOT_LABEL[item.mealSlot] : 'весь день'}
                            </span>
                          </div>
                          {modHint.length > 0 ? (
                            <p className="truncate pl-0 text-[11px] text-[color:var(--muted)]">{modHint.join(' · ')}</p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex justify-between gap-4 pt-2">
                    <span className="ui-body font-semibold">по подписке в месяц</span>
                    <span className="ui-h1 tabular-nums">{formatPrice(Math.round(effectivePricePerMonth))}</span>
                  </div>
                  {(() => {
                    const retailPerMonth = subscriptionPrice.perDelivery * deliveriesPerMonth
                    const subPrice = Math.round(effectivePricePerMonth)
                    const savingsPercent = retailPerMonth > 0 && retailPerMonth > subPrice
                      ? Math.round(((retailPerMonth - subPrice) / retailPerMonth) * 100)
                      : 0
                    if (savingsPercent <= 0) return null
                    return (
                      <div
                        className="rounded-xl px-3 py-2 text-center text-[12px] font-semibold"
                        style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', borderRadius: 'var(--radius-medium)' }}
                      >
                        −{savingsPercent}% к разовой покупке
                      </div>
                    )
                  })()}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selectedDays.map((d) => (
                      <span key={d} className="rounded-full bg-black/10 px-2.5 py-1 text-[12px] font-medium" style={{ borderRadius: 'var(--radius-pill)' }}>
                        {weekdays[d]}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="ui-muted text-[13px]">добавь блюда выше</p>
              )}
              </div>
            </details>

            <div className={`${cardClass} mt-4`}>
              <label className="ui-h2 mb-2 block text-[14px]">название</label>
              <input
                type="text"
                value={subscriptionName}
                onChange={(e) => setSubscriptionName(e.target.value)}
                placeholder="например: ежедневный обед"
                className="input w-full"
                style={{ borderRadius: 'var(--radius-medium)' }}
              />
            </div>

            {!isUnifiedCreate ? (
              <button
                type="button"
                onClick={goBack}
                className="ui-back-button mt-4 shrink-0"
                aria-label="назад"
              >
                <IconChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          {/* Sticky CTA: одна кнопка, липкая (над нижней навигацией) */}
          <div
            className="fixed left-0 right-0 z-50 border-t border-black/[0.06] bg-[color:var(--surface-strong)] p-4 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]"
            style={{
              bottom: 'calc(var(--ufo-bottomnav-h, 72px) + env(safe-area-inset-bottom))',
              paddingBottom: 16,
              paddingTop: 16,
            }}
          >
            <button
              type="button"
              onClick={onCreate}
              disabled={
                isCreating ||
                subscriptionPrice.dishesPerDelivery === 0 ||
                (!isEditMode && !subscriptionName.trim())
              }
              className="btn btn-primary w-full rounded-full py-4 text-[15px] font-semibold disabled:opacity-50"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {isCreating ? (isEditMode ? 'сохраняем…' : 'оформляем…') : isEditMode ? 'сохранить состав' : 'оформить подписку'}
            </button>
            {createError && (
              <div className="mt-2 text-center">
                <p className="text-[13px] font-medium text-red-600">{createError}</p>
                {(createError.includes('Telegram') || createError.includes('Войдите')) && typeof window !== 'undefined' && (window as any)?.Telegram?.WebApp?.initData && (
                  <button
                    type="button"
                    onClick={async () => {
                      setCreateError(null)
                      const initData = (window as any).Telegram?.WebApp?.initData
                      if (!initData) return
                      await signIn('telegram', { initData, redirect: false })
                      toast.success('Вход выполнен. Нажмите «оформить подписку» снова.')
                    }}
                    className="btn btn-soft mt-2 rounded-full px-4 py-2 text-[13px] font-semibold"
                    style={{ borderRadius: 'var(--radius-pill)' }}
                  >
                    повторить вход
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {(isEditMode || hasPlans || buildMode === 'custom') ? (
        <SubscriptionConstructorSummaryBar
          step={summaryBarStep}
          selectedDaysCount={selectedDays.length}
          deliveriesPerMonth={deliveriesPerMonth}
          perDelivery={subscriptionPrice.perDelivery}
          perWeek={subscriptionPrice.perWeek}
          retailPerMonth={liveQuote?.periodRetail ?? Math.round(subscriptionPrice.perDelivery * deliveriesPerMonth)}
          subscriptionPerMonth={Math.round(effectivePricePerMonth)}
          hasTemplate={buildMode === 'from_plan' && Boolean(selectedTemplate)}
          dishCount={selectedCount}
        />
      ) : null}
    </div>
  )
}
