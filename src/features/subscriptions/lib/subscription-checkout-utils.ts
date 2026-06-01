import type { Dish } from '@/types'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'

export type MenuCategory = { id: string; name: string; slug: string; emoji?: string | null }
export type SelectedLine = { dishId: string; quantity: number; mealSlot: MealSlot | null; modifierIds: string[] }

export type PeriodQuote = {
  guestPrice: number
  periodRetail: number
  guestSavingsPercent: number
  deliveriesInPeriod: number
  perDeliveryRetail: number
}

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

export const TAG_FILTERS = [
  { id: 'all', label: 'всё' },
  { id: 'hit', label: 'хит' },
  { id: 'new', label: 'новинка' },
  { id: 'chef-choice', label: 'выбор шефа' },
  { id: 'vegan', label: 'веган' },
] as const

export function wizardDayToJs(d: number) {
  return d === 6 ? 0 : d + 1
}

export function jsDayToWizard(d: number) {
  return d === 0 ? 6 : d - 1
}

export function lineKey(item: SelectedLine) {
  return `${item.dishId}:${item.mealSlot ?? 'any'}:${(item.modifierIds ?? []).join('|')}`
}

export function mapSubscriptionDish(d: any): Dish {
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

export function primaryDishTag(tags?: string[]): string | null {
  if (!Array.isArray(tags)) return null
  for (const t of ['hit', 'chef-choice', 'new', 'popular']) {
    if (tags.includes(t)) return t
  }
  return null
}

export function dishMatchesTagFilter(dish: Dish, tagFilter: string) {
  if (tagFilter === 'all') return true
  return (dish.tags ?? []).some((t) => String(t) === tagFilter)
}

export function formatFirstDeliveryMessage(startDate: Date, wizardDays: number[], time = '13:00') {
  if (!wizardDays.length) return 'выберите дни доставки'
  const jsDays = new Set(wizardDays.map(wizardDayToJs))
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  for (let i = 0; i < 21; i++) {
    const d = new Date(startDate)
    d.setHours(12, 0, 0, 0)
    d.setDate(startDate.getDate() + i)
    if (!jsDays.has(d.getDay())) continue
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
    const dayPart =
      diff === 0
        ? 'сегодня'
        : diff === 1
          ? 'завтра'
          : d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    return `Следующая доставка: ${dayPart} в ${time}`
  }
  const todayWizard = jsDayToWizard(new Date().getDay())
  let next = wizardDays.find((d) => d >= todayWizard) ?? wizardDays[0]
  return `Ближайшая доставка: ${WEEKDAYS[next]} в ${time}`
}

export function mealSlotShort(slot: MealSlot | null) {
  return slot ? MEAL_SLOT_LABEL[slot] : 'весь день'
}
