import type { MealSlot } from '@/lib/subscription-meal-slots'
import { getEnabledMealSlots, type SubscriptionConfig } from '@/lib/subscription-config'

export type SubscriptionItemInput = {
  dishId: string
  quantity: number
  mealSlot?: MealSlot | null
  modifierIds?: string[]
}

export type ResolvedMealSlotRules = {
  enabledSlots: Set<MealSlot>
  maxItemsBySlot: Record<MealSlot, number>
  allowedDishIdsBySlot: Record<MealSlot, Set<string> | null>
}

export function resolveMealSlotRules(config: SubscriptionConfig): ResolvedMealSlotRules {
  const enabled = getEnabledMealSlots(config)
  const enabledSlots = new Set<MealSlot>(enabled)
  const maxItemsBySlot = {} as Record<MealSlot, number>
  const allowedDishIdsBySlot = {} as Record<MealSlot, Set<string> | null>

  for (const slot of enabled) {
    const sc = config.mealSlots[slot]
    maxItemsBySlot[slot] = Math.max(0, sc?.maxItemsPerDelivery ?? 1)
    const ids = sc?.dishIds ?? []
    allowedDishIdsBySlot[slot] = ids.length > 0 ? new Set(ids) : null
  }

  return { enabledSlots, maxItemsBySlot, allowedDishIdsBySlot }
}

/** Per single delivery day — sum quantities by meal slot. */
export function itemsPerDeliveryBySlot(items: SubscriptionItemInput[]): Record<MealSlot, number> {
  const out: Record<MealSlot, number> = { breakfast: 0, lunch: 0, dinner: 0 }
  for (const it of items) {
    const slot = it.mealSlot
    if (slot === 'breakfast' || slot === 'lunch' || slot === 'dinner') {
      out[slot] += Math.max(0, it.quantity)
    }
  }
  return out
}

export function validateSubscriptionItemsByMealSlots(
  items: SubscriptionItemInput[],
  config: SubscriptionConfig,
  dishIdsEligible: Set<string>
): { valid: true } | { valid: false; error: string } {
  const rules = resolveMealSlotRules(config)
  if (rules.enabledSlots.size === 0) {
    return { valid: false, error: 'Подписки не настроены: включите хотя бы один слот (завтрак/обед/ужин).' }
  }

  for (const it of items) {
    if (!dishIdsEligible.has(it.dishId)) {
      return { valid: false, error: 'Блюдо недоступно для подписки.' }
    }
    const slot = it.mealSlot
    if (!slot || !rules.enabledSlots.has(slot)) {
      return { valid: false, error: 'У каждой позиции должен быть включённый слот приёма пищи.' }
    }
    const allowed = rules.allowedDishIdsBySlot[slot]
    if (allowed && !allowed.has(it.dishId)) {
      return { valid: false, error: `Блюдо не входит в слот «${slot}».` }
    }
  }

  const bySlot = itemsPerDeliveryBySlot(items)
  for (const slot of rules.enabledSlots) {
    const max = rules.maxItemsBySlot[slot] ?? 0
    if (bySlot[slot] > max) {
      return { valid: false, error: `В слоте «${slot}» можно не более ${max} блюд за доставку.` }
    }
  }

  return { valid: true }
}
