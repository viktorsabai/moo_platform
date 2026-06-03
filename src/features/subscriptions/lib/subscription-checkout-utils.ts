import type { Dish } from '@/types'
import { MEAL_SLOT_LABEL, type MealSlot } from '@/lib/subscription-meal-slots'
import { getEnabledMealSlots, type SubscriptionConfig } from '@/lib/subscription-config'

export type MenuCategory = { id: string; name: string; slug: string; emoji?: string | null }
export type SelectedLine = {
  dishId: string
  quantity: number
  mealSlot: MealSlot | null
  modifierIds: string[]
  /** JS weekday 0=Вс … 6=Сб */
  dayOfWeek: number
}

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
  return `${item.dayOfWeek}:${item.dishId}:${item.mealSlot ?? 'any'}:${(item.modifierIds ?? []).join('|')}`
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
    ...(d.category ? { category: d.category } : {}),
  } as Dish
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

export function parseJsonArray<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && Array.isArray((data as { dishes?: unknown }).dishes)) {
    return (data as { dishes: T[] }).dishes
  }
  return []
}

export function buildRequiredSlotsByJsDay(
  selectedWizardDays: number[],
  slotsByWizardDay: Record<number, MealSlot[]>,
  fallbackSlots: MealSlot[]
): Record<number, MealSlot[]> {
  const out: Record<number, MealSlot[]> = {}
  for (const w of selectedWizardDays) {
    const js = wizardDayToJs(w)
    const slots = slotsByWizardDay[w]?.length ? slotsByWizardDay[w] : fallbackSlots
    out[js] = [...slots]
  }
  return out
}

export function dishHasConfigurableOptions(dish: Dish): boolean {
  const mods = dish.modifiers ?? []
  const groups = dish.optionGroups ?? []
  return mods.length > 0 || groups.some((g) => (g.values?.length ?? 0) > 0)
}

/** Краткая подпись выбранных опций для карточки блюда. */
export function summarizeLineModifiers(dish: Dish, modifierIds: string[] | undefined): string | null {
  const ids = modifierIds ?? []
  if (!ids.length) return null
  const names: string[] = []
  for (const m of dish.modifiers ?? []) {
    if (ids.includes(m.id) && m.name) names.push(m.name)
  }
  for (const g of dish.optionGroups ?? []) {
    for (const v of g.values ?? []) {
      if (ids.includes(v.id) && v.name) names.push(v.name)
    }
  }
  if (!names.length) return null
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

export function categoriesFromDishes(dishes: Dish[], categories: MenuCategory[]): MenuCategory[] {
  const dishCatIds = new Set(dishes.map((d) => d.categoryId || 'uncat'))
  if (categories.length > 0) {
    const fromApi = categories.filter((c) => dishCatIds.has(c.id))
    if (fromApi.length > 0) return fromApi
  }
  const map = new Map<string, MenuCategory>()
  for (const d of dishes) {
    const cid = d.categoryId || 'uncat'
    if (map.has(cid)) continue
    const cat = (d as Dish & { category?: { name?: string; emoji?: string | null } }).category
    map.set(cid, {
      id: cid,
      name: cat?.name ?? 'меню',
      slug: cid,
      emoji: cat?.emoji ?? null,
    })
  }
  return Array.from(map.values())
}

export type DishPickerSection = { category: MenuCategory; dishes: Dish[] }

/** Секции меню с заголовками категорий (для списка блюд). */
export function groupDishesForPicker(
  dishes: Dish[],
  categories: MenuCategory[],
  categoryFilter: string
): DishPickerSection[] {
  let list = dishes
  if (categoryFilter.startsWith('tag:')) {
    list = list.filter((d) => dishMatchesTagFilter(d, categoryFilter.slice(4)))
  } else if (categoryFilter !== 'all') {
    list = list.filter((d) => (d.categoryId || 'uncat') === categoryFilter)
  }

  const byCat = new Map<string, Dish[]>()
  for (const d of list) {
    const cid = d.categoryId || 'uncat'
    const arr = byCat.get(cid) ?? []
    arr.push(d)
    byCat.set(cid, arr)
  }

  const sections: DishPickerSection[] = []
  const seen = new Set<string>()
  for (const cat of categories) {
    const items = byCat.get(cat.id)
    if (!items?.length) continue
    seen.add(cat.id)
    sections.push({ category: cat, dishes: items })
  }
  for (const [cid, items] of byCat) {
    if (seen.has(cid) || !items.length) continue
    const cat = categories.find((c) => c.id === cid)
    sections.push({
      category: cat ?? { id: cid, name: 'меню', slug: cid, emoji: null },
      dishes: items,
    })
  }
  return sections
}

/** Следующий незаполненный приём (для подсказки внизу). */
export function nextMissingMealHint(
  lines: SelectedLine[],
  wizardDays: number[],
  slotsByWizardDay: Record<number, MealSlot[]>,
  enabledSlots: MealSlot[]
): string | null {
  for (const w of [...wizardDays].sort((a, b) => a - b)) {
    const js = wizardDayToJs(w)
    const slots = slotsForWizardDay(slotsByWizardDay, w, enabledSlots)
    for (const slot of slots) {
      if (!lines.some((l) => l.dayOfWeek === js && l.mealSlot === slot)) {
        return `${WEEKDAYS[w]} · ${MEAL_SLOT_LABEL[slot]}`
      }
    }
  }
  return null
}

/** Одна строка для шапки чекаута — без перечисления каждого приёма. */
export function formatRationCheckoutSummary(lines: SelectedLine[], wizardDays: number[]) {
  if (!lines.length || !wizardDays.length) return null
  const dishWord = lines.length === 1 ? 'блюдо' : lines.length < 5 ? 'блюда' : 'блюд'
  const dayWord = wizardDays.length === 1 ? 'день' : wizardDays.length < 5 ? 'дня' : 'дней'
  return `${lines.length} ${dishWord} · ${wizardDays.length} ${dayWord} доставки`
}

export function formatStartDateRu(date: Date) {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function slotsForWizardDay(
  slotsByWizardDay: Record<number, MealSlot[]>,
  wizardDay: number,
  enabledSlots: MealSlot[]
): MealSlot[] {
  const custom = slotsByWizardDay[wizardDay]
  return custom?.length ? custom : enabledSlots
}

/** Группы строк рациона по приёмам пищи (только слоты, где есть позиции). */
export function groupDayLinesByMealSlot(
  lines: SelectedLine[],
  jsDay: number,
  slotOrder: MealSlot[]
): { slot: MealSlot | null; items: SelectedLine[] }[] {
  const dayItems = lines.filter((l) => l.dayOfWeek === jsDay)
  const groups: { slot: MealSlot | null; items: SelectedLine[] }[] = []
  for (const slot of slotOrder) {
    const items = dayItems.filter((l) => l.mealSlot === slot)
    if (items.length) groups.push({ slot, items })
  }
  const other = dayItems.filter((l) => !l.mealSlot || !slotOrder.includes(l.mealSlot as MealSlot))
  if (other.length) groups.push({ slot: null, items: other })
  return groups
}

export function mealSlotShort(slot: MealSlot | null) {
  return slot ? MEAL_SLOT_LABEL[slot] : 'весь день'
}

/** Dish ids owner assigned to any enabled meal slot. null = no restriction (show all eligible). */
export function guestCatalogDishIds(config: SubscriptionConfig): Set<string> | null {
  const ids = new Set<string>()
  let restricted = false
  for (const slot of getEnabledMealSlots(config)) {
    const list = config.mealSlots[slot]?.dishIds ?? []
    if (list.length > 0) {
      restricted = true
      for (const id of list) ids.add(id)
    }
  }
  return restricted ? ids : null
}

export function allowedOptionIdsForLine(config: SubscriptionConfig, mealSlot: MealSlot | null): string[] | null {
  if (!mealSlot) return null
  const ids = config.mealSlots[mealSlot]?.optionIds ?? []
  return ids.length > 0 ? ids : null
}
