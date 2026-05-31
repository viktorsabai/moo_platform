import type { MealSlot } from '@/lib/subscription-meal-slots'
import {
  getEnabledMealSlots,
  type SubscriptionConfig,
} from '@/lib/subscription-config'
import type { SubscriptionItemInput } from '@/lib/subscription-meal-slot-rules'

export type PrefillDish = { id: string; tags?: string[] }

export type PrefillCriteria = {
  enabledSlots: MealSlot[]
  deliveryDays: number[]
  personCount: number
  periodDays: number
  goal?: 'simple' | 'fit' | 'family' | null
}

function pickDishId(
  slot: MealSlot,
  config: SubscriptionConfig,
  eligibleDishes: PrefillDish[],
  used: Set<string>,
  favorites: Set<string>
): string | null {
  const sc = config.mealSlots[slot]
  const pool = (sc?.defaultDishIds?.length ? sc.defaultDishIds : sc?.dishIds?.length ? sc.dishIds : eligibleDishes.map((d) => d.id))
    .filter((id) => eligibleDishes.some((d) => d.id === id))

  for (const id of pool) {
    if (favorites.has(id) && !used.has(id)) return id
  }
  for (const id of pool) {
    if (!used.has(id)) return id
  }
  return pool[0] ?? eligibleDishes[0]?.id ?? null
}

/** Smart default weekdays: Mon–Fri if lunch-only, else all enabled days. */
export function suggestDeliveryDays(config: SubscriptionConfig, slots: MealSlot[]): number[] {
  const enabled = slots.length ? slots : getEnabledMealSlots(config)
  const lunchOnly = enabled.length === 1 && enabled[0] === 'lunch'
  if (lunchOnly) return [1, 2, 3, 4, 5]
  const min = config.minDaysPerWeek
  const max = config.maxDaysPerWeek
  const base = [1, 2, 3, 4, 5, 6, 0].slice(0, Math.max(min, Math.min(max, 5)))
  return base.length >= min ? base : [1, 2, 3].slice(0, min)
}

export function buildPrefillItems(
  config: SubscriptionConfig,
  eligibleDishes: PrefillDish[],
  criteria: PrefillCriteria,
  favoriteDishIds: string[] = []
): SubscriptionItemInput[] {
  const slots = criteria.enabledSlots.length ? criteria.enabledSlots : getEnabledMealSlots(config)
  const favorites = new Set(favoriteDishIds)
  const used = new Set<string>()
  const items: SubscriptionItemInput[] = []

  for (const slot of slots) {
    const max = config.mealSlots[slot]?.maxItemsPerDelivery ?? 1
    for (let i = 0; i < max; i++) {
      const dishId = pickDishId(slot, config, eligibleDishes, used, favorites)
      if (!dishId) continue
      used.add(dishId)
      items.push({ dishId, quantity: 1, mealSlot: slot, modifierIds: [] })
    }
  }

  return items
}
