import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

function jsDayLabel(js: number): string {
  const wizard = js === 0 ? 6 : js - 1
  return WEEKDAY_LABELS[wizard] ?? 'день'
}

export type SubscriptionItemNotifyInput = {
  name?: string | null
  quantity?: number
  mealSlot?: MealSlot | string | null
  dayOfWeek?: number | null
}

/** Строки для Telegram-уведомлений о подписке (день · приём · блюдо). */
export function formatSubscriptionItemsNotifySummary(items: SubscriptionItemNotifyInput[], max = 8): string {
  const lines: string[] = []
  for (const it of items) {
    if (lines.length >= max) break
    const qty = Math.max(1, Number(it.quantity ?? 1))
    const name = String(it.name || 'блюдо').trim()
    const meal = it.mealSlot ? MEAL_SLOT_LABEL[it.mealSlot as MealSlot] ?? String(it.mealSlot) : ''
    const day = it.dayOfWeek != null && Number.isFinite(it.dayOfWeek) ? jsDayLabel(Number(it.dayOfWeek)) : ''
    const prefix = [day, meal].filter(Boolean).join(' · ')
    lines.push(prefix ? `${prefix}: ${qty}× ${name}` : `${qty}× ${name}`)
  }
  if (items.length > max) lines.push(`…ещё ${items.length - max}`)
  return lines.join('\n')
}
