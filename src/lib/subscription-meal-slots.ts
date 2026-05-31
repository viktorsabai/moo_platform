/** Слоты приёма пищи в конструкторе подписки (витрина). */
export const MEAL_SLOT_IDS = ['breakfast', 'lunch', 'dinner'] as const
export type MealSlot = (typeof MEAL_SLOT_IDS)[number]

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'завтрак',
  lunch: 'обед',
  dinner: 'ужин',
}

export function parseMealSlot(raw: unknown): MealSlot | null {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (s === 'breakfast' || s === 'lunch' || s === 'dinner') return s
  return null
}

export function isMealSlot(v: string | null | undefined): v is MealSlot {
  return v === 'breakfast' || v === 'lunch' || v === 'dinner'
}
