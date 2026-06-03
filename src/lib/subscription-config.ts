import { MEAL_SLOT_IDS, type MealSlot } from '@/lib/subscription-meal-slots'

export type MealSlotConfig = {
  enabled: boolean
  /** 0 = безлимит позиций за одну доставку в этом слоте */
  maxItemsPerDelivery: number
  dishIds: string[]
  defaultDishIds: string[]
  /** @deprecated Per-dish limits removed from UX; kept for legacy JSON only */
  dishLimits?: Record<string, number>
  /** Subscription-eligible option value ids available in this slot. */
  optionIds?: string[]
}

export type SubscriptionCommerceConfig = {
  targetMarginPercent: number
  subscriptionDiscountPercent: number
  minMarginPercent: number
  priceRoundTo: number
}

export const DEFAULT_PERIOD_DISCOUNTS: Record<number, number> = {
  7: 0,
  14: 3,
  28: 8,
}

export type SubscriptionConfig = {
  mealSlots: Record<MealSlot, MealSlotConfig>
  commerce: SubscriptionCommerceConfig
  /** categoryId → max portions from category per delivery; omitted = безлимит */
  categoryLimits?: Record<string, number>
  minDaysPerWeek: number
  maxDaysPerWeek: number
  minPersons: number
  maxPersons: number
  defaultPeriodDays: number
  availablePeriods: number[]
  /** Extra discount % on top of subscriptionDiscountPercent, keyed by period length (days). */
  periodDiscounts?: Record<number, number>
  /** Owner override for typical subscription price (period total, THB). Clamped to min margin in pricing engine. */
  ownerPriceOverride?: number | null
}

export function periodLabel(days: number): string {
  if (days === 7) return '1 неделя'
  if (days === 14) return '2 недели'
  if (days === 28) return '1 месяц'
  return `${days} дн.`
}

/** После «за» в подписи: «5 доставок за 1 неделю». */
export function periodLabelAccusative(days: number): string {
  if (days === 7) return '1 неделю'
  if (days === 14) return '2 недели'
  if (days === 28) return '1 месяц'
  return `${days} дней`
}

export function getPeriodDiscountPercent(
  periodDiscounts: Record<number, number> | undefined,
  periodDays: number
): number {
  const map = periodDiscounts ?? DEFAULT_PERIOD_DISCOUNTS
  return map[periodDays] ?? 0
}

export const DEFAULT_COMMERCE: SubscriptionCommerceConfig = {
  targetMarginPercent: 35,
  subscriptionDiscountPercent: 12,
  minMarginPercent: 20,
  priceRoundTo: 50,
}

export const DEFAULT_MEAL_SLOT: MealSlotConfig = {
  enabled: false,
  maxItemsPerDelivery: 0,
  dishIds: [],
  defaultDishIds: [],
}

export function defaultSubscriptionConfig(): SubscriptionConfig {
  return {
    mealSlots: {
      breakfast: { ...DEFAULT_MEAL_SLOT, enabled: false, maxItemsPerDelivery: 0 },
      lunch: { ...DEFAULT_MEAL_SLOT, enabled: true, maxItemsPerDelivery: 0 },
      dinner: { ...DEFAULT_MEAL_SLOT, enabled: false, maxItemsPerDelivery: 0 },
    },
    commerce: { ...DEFAULT_COMMERCE },
    minDaysPerWeek: 3,
    maxDaysPerWeek: 7,
    minPersons: 1,
    maxPersons: 4,
    defaultPeriodDays: 28,
    availablePeriods: [7, 14, 28],
    periodDiscounts: { ...DEFAULT_PERIOD_DISCOUNTS },
  }
}

function parsePeriodDiscounts(raw: unknown, periods: number[]): Record<number, number> {
  const result: Record<number, number> = {}
  for (const days of periods) {
    let v = DEFAULT_PERIOD_DISCOUNTS[days] ?? 0
    if (isRecord(raw)) {
      const rawVal = raw[String(days)]
      const num = Number(rawVal)
      if (Number.isFinite(num)) v = Math.max(0, Math.min(50, num))
    }
    result[days] = v
  }
  return result
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseMealSlotConfig(raw: unknown, fallback: MealSlotConfig): MealSlotConfig {
  if (!isRecord(raw)) return { ...fallback }
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    maxItemsPerDelivery:
      typeof raw.maxItemsPerDelivery === 'number' && Number.isFinite(raw.maxItemsPerDelivery)
        ? Math.max(0, Math.min(99, Math.round(raw.maxItemsPerDelivery)))
        : fallback.maxItemsPerDelivery,
    dishIds: Array.isArray(raw.dishIds)
      ? (raw.dishIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
      : [...fallback.dishIds],
    defaultDishIds: Array.isArray(raw.defaultDishIds)
      ? (raw.defaultDishIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
      : [...fallback.defaultDishIds],
    dishLimits: isRecord(raw.dishLimits)
      ? Object.fromEntries(
          Object.entries(raw.dishLimits)
            .map(([k, v]) => [String(k).trim(), Math.max(1, Math.min(10, Math.round(Number(v) || 1)))])
            .filter(([k]) => k)
        )
      : { ...(fallback.dishLimits ?? {}) },
    optionIds: Array.isArray(raw.optionIds)
      ? (raw.optionIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
      : [...(fallback.optionIds ?? [])],
  }
}

function parseCommerce(raw: unknown): SubscriptionCommerceConfig {
  const d = DEFAULT_COMMERCE
  if (!isRecord(raw)) return { ...d }
  const num = (key: keyof SubscriptionCommerceConfig, min: number, max: number) => {
    const v = Number(raw[key])
    return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : d[key]
  }
  return {
    targetMarginPercent: num('targetMarginPercent', 0, 90),
    subscriptionDiscountPercent: num('subscriptionDiscountPercent', 0, 90),
    minMarginPercent: num('minMarginPercent', 0, 90),
    priceRoundTo: num('priceRoundTo', 1, 1000),
  }
}

export function parseSubscriptionConfig(raw: unknown): SubscriptionConfig {
  const base = defaultSubscriptionConfig()
  if (!isRecord(raw)) return base

  const mealSlotsRaw = isRecord(raw.mealSlots) ? raw.mealSlots : {}
  const mealSlots = { ...base.mealSlots }
  for (const slot of MEAL_SLOT_IDS) {
    mealSlots[slot] = parseMealSlotConfig(mealSlotsRaw[slot], base.mealSlots[slot])
  }

  const periods = Array.isArray(raw.availablePeriods)
    ? (raw.availablePeriods as unknown[])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n >= 7 && n <= 90)
    : base.availablePeriods

  const intField = (key: keyof SubscriptionConfig, min: number, max: number) => {
    const v = Number(raw[key])
    return Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : (base[key] as number)
  }

  const ownerRaw = Number(raw.ownerPriceOverride)
  const ownerPriceOverride =
    Number.isFinite(ownerRaw) && ownerRaw > 0 ? Math.round(ownerRaw) : null

  const categoryLimitsRaw = isRecord(raw.categoryLimits) ? raw.categoryLimits : {}
  const categoryLimits = Object.fromEntries(
    Object.entries(categoryLimitsRaw)
      .map(([k, v]) => [String(k).trim(), Math.max(1, Math.min(99, Math.round(Number(v) || 1)))])
      .filter(([k]) => k)
  )

  return {
    mealSlots,
    commerce: parseCommerce(raw.commerce),
    categoryLimits: Object.keys(categoryLimits).length ? categoryLimits : undefined,
    minDaysPerWeek: intField('minDaysPerWeek', 1, 7),
    maxDaysPerWeek: intField('maxDaysPerWeek', 1, 7),
    minPersons: intField('minPersons', 1, 10),
    maxPersons: intField('maxPersons', 1, 10),
    defaultPeriodDays: intField('defaultPeriodDays', 7, 90),
    availablePeriods: periods.length ? [...new Set(periods)].sort((a, b) => a - b) : base.availablePeriods,
    periodDiscounts: parsePeriodDiscounts(
      raw.periodDiscounts,
      periods.length ? [...new Set(periods)].sort((a, b) => a - b) : base.availablePeriods
    ),
    ownerPriceOverride,
  }
}

export function getEnabledMealSlots(config: SubscriptionConfig): MealSlot[] {
  return MEAL_SLOT_IDS.filter((s) => config.mealSlots[s]?.enabled)
}
