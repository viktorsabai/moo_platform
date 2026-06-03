import type { MealSlot } from '@/lib/subscription-meal-slots'

export type SubscriptionBuilderDraft = {
  v: 1
  updatedAt: number
  phase: 'build' | 'checkout'
  selectedDays: number[]
  activeWizardDay: number
  activeSlot: MealSlot
  periodDays: number
  personCount: number
  deliveryTime: string
  startDate: string
  name: string
  lines: Array<{
    dishId: string
    quantity: number
    mealSlot: MealSlot | null
    modifierIds: string[]
    dayOfWeek: number
  }>
}

const PREFIX = 'ufo:subscription-builder:'

function key(restaurantId: string) {
  return `${PREFIX}${restaurantId || 'default'}`
}

export function saveSubscriptionBuilderDraft(restaurantId: string, draft: SubscriptionBuilderDraft) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key(restaurantId), JSON.stringify({ ...draft, updatedAt: Date.now() }))
    window.dispatchEvent(new Event('ufo:subscription-draft'))
  } catch {
    // ignore quota
  }
}

export function loadSubscriptionBuilderDraft(restaurantId: string): SubscriptionBuilderDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key(restaurantId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SubscriptionBuilderDraft
    if (parsed?.v !== 1 || !Array.isArray(parsed.lines)) return null
    const age = Date.now() - (parsed.updatedAt ?? 0)
    if (age > 7 * 24 * 60 * 60 * 1000) {
      clearSubscriptionBuilderDraft(restaurantId)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearSubscriptionBuilderDraft(restaurantId: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(key(restaurantId))
    window.dispatchEvent(new Event('ufo:subscription-draft'))
  } catch {
    // ignore
  }
}
