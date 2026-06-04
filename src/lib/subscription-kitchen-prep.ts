import { MEAL_SLOT_LABEL, parseMealSlot, type MealSlot } from '@/lib/subscription-meal-slots'

export type SubscriptionItemForPrep = {
  quantity: number
  dayOfWeek: number | null
  mealSlot: string | null
  dish: { name: string } | null
}

export type SubscriptionForPrep = {
  id: string
  name: string
  status: string
  deliveryTime: string | null
  items: SubscriptionItemForPrep[]
  deliveries: { id: string; scheduledDate: string; status: string }[]
  user?: { displayName?: string; name?: string } | null
}

export type KitchenDishLine = {
  dishName: string
  quantity: number
  mealSlot: MealSlot | null
  mealLabel: string | null
}

export type KitchenDeliveryRow = {
  deliveryId: string
  subscriptionId: string
  subscriptionName: string
  clientName: string
  deliveryTime: string | null
  status: string
  dishes: KitchenDishLine[]
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function itemsForDeliveryDay(items: SubscriptionItemForPrep[], deliveryDate: Date): KitchenDishLine[] {
  const dow = deliveryDate.getDay()
  const lines: KitchenDishLine[] = []
  for (const it of items) {
    if (it.dayOfWeek != null && it.dayOfWeek !== dow) continue
    const dishName = it.dish?.name?.trim()
    if (!dishName) continue
    const slot = parseMealSlot(it.mealSlot)
    lines.push({
      dishName,
      quantity: Math.max(1, it.quantity || 1),
      mealSlot: slot,
      mealLabel: slot ? MEAL_SLOT_LABEL[slot] : null,
    })
  }
  return lines
}

function aggregateDishes(rows: KitchenDeliveryRow[]): KitchenDishLine[] {
  const map = new Map<string, KitchenDishLine>()
  for (const row of rows) {
    for (const d of row.dishes) {
      const key = `${d.mealSlot ?? 'any'}:${d.dishName}`
      const prev = map.get(key)
      if (prev) prev.quantity += d.quantity
      else map.set(key, { ...d })
    }
  }
  return [...map.values()].sort((a, b) => {
    const slotOrder = (s: MealSlot | null) => (s === 'breakfast' ? 0 : s === 'lunch' ? 1 : s === 'dinner' ? 2 : 3)
    const diff = slotOrder(a.mealSlot) - slotOrder(b.mealSlot)
    if (diff !== 0) return diff
    return a.dishName.localeCompare(b.dishName, 'ru')
  })
}

/** Свод для кухни на выбранный день по расписанию доставок. */
export function buildKitchenPrepForDay(subs: SubscriptionForPrep[], targetDayKey: string) {
  const deliveries: KitchenDeliveryRow[] = []

  for (const sub of subs) {
    if (sub.status !== 'ACTIVE') continue
    const clientName = sub.user?.displayName ?? sub.user?.name ?? 'гость'

    for (const del of sub.deliveries ?? []) {
      if (del.status === 'CANCELLED' || del.status === 'DELIVERED') continue
      const date = startOfDay(new Date(del.scheduledDate))
      if (dayKey(date) !== targetDayKey) continue
      const dishes = itemsForDeliveryDay(sub.items, date)
      if (dishes.length === 0) continue
      deliveries.push({
        deliveryId: del.id,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        clientName,
        deliveryTime: sub.deliveryTime,
        status: del.status,
        dishes,
      })
    }
  }

  deliveries.sort((a, b) => {
    const ta = a.deliveryTime ?? '99:99'
    const tb = b.deliveryTime ?? '99:99'
    return ta.localeCompare(tb)
  })

  return {
    deliveries,
    aggregate: aggregateDishes(deliveries),
    deliveryCount: deliveries.length,
  }
}

export function buildDeliveryCalendar(subs: SubscriptionForPrep[], days = 14) {
  const today = startOfDay(new Date())
  const result: { date: Date; key: string; count: number }[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const key = dayKey(date)
    const prep = buildKitchenPrepForDay(subs, key)
    result.push({ date, key, count: prep.deliveryCount })
  }
  return result
}
