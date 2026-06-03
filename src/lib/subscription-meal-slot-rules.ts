import { MEAL_SLOT_LABEL, parseMealSlot, type MealSlot } from '@/lib/subscription-meal-slots'
import { getEnabledMealSlots, type SubscriptionConfig } from '@/lib/subscription-config'

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

function jsDayToWizardLabel(jsDay: number) {
  const wizard = jsDay === 0 ? 6 : jsDay - 1
  return WEEKDAY_LABELS[wizard] ?? 'день'
}

export function parseRequiredMealSlotsByDay(raw: unknown): Record<number, MealSlot[]> {
  const out: Record<number, MealSlot[]> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const js = Number(key)
    if (!Number.isFinite(js) || js < 0 || js > 6 || !Array.isArray(val)) continue
    const slots = val.map((s) => parseMealSlot(s)).filter((s): s is MealSlot => Boolean(s))
    if (slots.length) out[js] = slots
  }
  return out
}

export type SubscriptionItemInput = {
  dishId: string
  quantity: number
  mealSlot?: MealSlot | null
  modifierIds?: string[]
  /** 0=Вс … 6=Сб (как в Subscription.deliveryDays). null = на все дни (legacy). */
  dayOfWeek?: number | null
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
    const rawMax = sc?.maxItemsPerDelivery ?? 0
    maxItemsBySlot[slot] = rawMax <= 0 ? 999 : rawMax
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

/** Какие приёмы обязательны в конкретный день доставки (js 0–6). Без карты — все включённые слоты. */
export function validateSubscriptionItemsByMealSlots(
  items: SubscriptionItemInput[],
  config: SubscriptionConfig,
  dishIdsEligible: Set<string>,
  deliveryDaysJs?: number[],
  requiredSlotsByJsDay?: Record<number, MealSlot[]>
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

  const jsDays =
    deliveryDaysJs && deliveryDaysJs.length > 0
      ? [...new Set(deliveryDaysJs.filter((d) => d >= 0 && d <= 6))]
      : null

  if (jsDays && items.some((it) => it.dayOfWeek != null)) {
    for (const jsDay of jsDays) {
      const dayItems = items.filter((it) => it.dayOfWeek === jsDay)
      const bySlot = itemsPerDeliveryBySlot(dayItems)
      const required =
        requiredSlotsByJsDay?.[jsDay]?.filter((s) => rules.enabledSlots.has(s)) ??
        [...rules.enabledSlots]
      if (required.length === 0) {
        return { valid: false, error: `На ${jsDayToWizardLabel(jsDay)} выберите хотя бы один приём пищи.` }
      }
      const dayQty = required.reduce((sum, slot) => sum + bySlot[slot], 0)
      if (dayQty <= 0) {
        return { valid: false, error: `На ${jsDayToWizardLabel(jsDay)} добавьте блюда в выбранные приёмы.` }
      }
      for (const slot of required) {
        const max = rules.maxItemsBySlot[slot] ?? 999
        if (bySlot[slot] <= 0) {
          return {
            valid: false,
            error: `На ${jsDayToWizardLabel(jsDay)} выберите · ${MEAL_SLOT_LABEL[slot]}`,
          }
        }
        if (max < 999 && bySlot[slot] > max) {
          return { valid: false, error: `На ${jsDayToWizardLabel(jsDay)} в «${slot}» не более ${max} блюд.` }
        }
      }
    }
    return { valid: true }
  }

  const bySlot = itemsPerDeliveryBySlot(items)
  for (const slot of rules.enabledSlots) {
    const max = rules.maxItemsBySlot[slot] ?? 999
    if (max >= 999) continue
    if (bySlot[slot] > max) {
      return { valid: false, error: `В слоте «${slot}» можно не более ${max} блюд за доставку.` }
    }
  }

  return { valid: true }
}
