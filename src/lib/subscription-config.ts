import { MEAL_SLOT_IDS, type MealSlot } from '@/lib/subscription-meal-slots'

export type MealSlotConfig = {
  enabled: boolean
  maxItemsPerDelivery: number
  dishIds: string[]
  defaultDishIds: string[]
}

export type SubscriptionCommerceConfig = {
  targetMarginPercent: number
  subscriptionDiscountPercent: number
  minMarginPercent: number
  priceRoundTo: number
}

export type SubscriptionConfig = {
  mealSlots: Record<MealSlot, MealSlotConfig>
  commerce: SubscriptionCommerceConfig
  minDaysPerWeek: number
  maxDaysPerWeek: number
  minPersons: number
  maxPersons: number
  defaultPeriodDays: number
  availablePeriods: number[]
  /** Owner override for typical subscription price (period total, THB). Clamped to min margin in pricing engine. */
  ownerPriceOverride?: number | null
}

export const DEFAULT_COMMERCE: SubscriptionCommerceConfig = {
  targetMarginPercent: 35,
  subscriptionDiscountPercent: 12,
  minMarginPercent: 20,
  priceRoundTo: 50,
}

export const DEFAULT_MEAL_SLOT: MealSlotConfig = {
  enabled: false,
  maxItemsPerDelivery: 1,
  dishIds: [],
  defaultDishIds: [],
}

export function defaultSubscriptionConfig(): SubscriptionConfig {
  return {
    mealSlots: {
      breakfast: { ...DEFAULT_MEAL_SLOT, enabled: false, maxItemsPerDelivery: 1 },
      lunch: { ...DEFAULT_MEAL_SLOT, enabled: true, maxItemsPerDelivery: 1 },
      dinner: { ...DEFAULT_MEAL_SLOT, enabled: false, maxItemsPerDelivery: 1 },
    },
    commerce: { ...DEFAULT_COMMERCE },
    minDaysPerWeek: 3,
    maxDaysPerWeek: 7,
    minPersons: 1,
    maxPersons: 4,
    defaultPeriodDays: 28,
    availablePeriods: [7, 14, 28],
  }
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
        ? Math.max(0, Math.min(10, Math.round(raw.maxItemsPerDelivery)))
        : fallback.maxItemsPerDelivery,
    dishIds: Array.isArray(raw.dishIds)
      ? (raw.dishIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
      : [...fallback.dishIds],
    defaultDishIds: Array.isArray(raw.defaultDishIds)
      ? (raw.defaultDishIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
      : [...fallback.defaultDishIds],
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

  return {
    mealSlots,
    commerce: parseCommerce(raw.commerce),
    minDaysPerWeek: intField('minDaysPerWeek', 1, 7),
    maxDaysPerWeek: intField('maxDaysPerWeek', 1, 7),
    minPersons: intField('minPersons', 1, 10),
    maxPersons: intField('maxPersons', 1, 10),
    defaultPeriodDays: intField('defaultPeriodDays', 7, 90),
    availablePeriods: periods.length ? [...new Set(periods)].sort((a, b) => a - b) : base.availablePeriods,
    ownerPriceOverride,
  }
}

export function getEnabledMealSlots(config: SubscriptionConfig): MealSlot[] {
  return MEAL_SLOT_IDS.filter((s) => config.mealSlots[s]?.enabled)
}
