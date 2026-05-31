/**
 * Единый источник правил плана подписки для бэкенда.
 * Разрешает правила из шаблона (БД) и пресета; валидирует items при создании/обновлении подписки.
 */

import { getDefaultPlanBySlug } from './subscription-plans'

export type PlanTemplateForRules = {
  presetSlug?: string | null
  allowedCategoryIds?: string[] | null
  /** Prisma returns JsonValue; we accept object or null. */
  categoryLimits?: Record<string, number> | null | unknown
  minDishesPerDelivery?: number | null
  maxDishesPerDelivery?: number | null
  minDaysPerWeek?: number | null
  maxDaysPerWeek?: number | null
}

export type CategoryForRules = { id: string; slug: string | null }

export type ResolvedPlanRules = {
  allowedCategoryIds: Set<string>
  categoryLimits: Record<string, number>
  minDishesPerDelivery: number
  maxDishesPerDelivery: number
  minDaysPerWeek: number
  maxDaysPerWeek: number
}

const DEFAULT_MIN_DISHES = 1
const DEFAULT_MAX_DISHES = 5
const DEFAULT_MIN_DAYS = 3
const DEFAULT_MAX_DAYS = 7

/**
 * Возвращает разрешённые правила плана: из шаблона (БД) или из пресета по presetSlug с маппингом slug → categoryId.
 */
export function getPlanRules(
  template: PlanTemplateForRules,
  categories: CategoryForRules[]
): ResolvedPlanRules {
  const preset = template.presetSlug ? getDefaultPlanBySlug(template.presetSlug) : null
  const slugToId = new Map(categories.map((c) => [c.slug ?? c.id, c.id]))

  let allowedCategoryIds: Set<string>
  let categoryLimits: Record<string, number>
  let minDishesPerDelivery: number
  let maxDishesPerDelivery: number
  let minDaysPerWeek: number
  let maxDaysPerWeek: number

  if (preset?.rules) {
    const slugs = preset.rules.allowedCategorySlugs ?? []
    allowedCategoryIds = new Set(
      slugs.length > 0
        ? slugs.map((s) => slugToId.get(s)).filter(Boolean) as string[]
        : categories.map((c) => c.id)
    )
    categoryLimits = {}
    for (const [slug, n] of Object.entries(preset.rules.categoryLimits ?? {})) {
      const catId = slugToId.get(slug)
      if (catId) categoryLimits[catId] = n
    }
    minDishesPerDelivery = preset.rules.minDishesPerDelivery ?? DEFAULT_MIN_DISHES
    maxDishesPerDelivery = preset.rules.maxDishesPerDelivery ?? DEFAULT_MAX_DISHES
    minDaysPerWeek = preset.rules.minDaysPerWeek ?? DEFAULT_MIN_DAYS
    maxDaysPerWeek = preset.rules.maxDaysPerWeek ?? DEFAULT_MAX_DAYS
  } else {
    allowedCategoryIds =
      Array.isArray(template.allowedCategoryIds) && template.allowedCategoryIds.length > 0
        ? new Set(template.allowedCategoryIds)
        : new Set(categories.map((c) => c.id))
    const rawLimits = template.categoryLimits
    categoryLimits =
      rawLimits && typeof rawLimits === 'object' && !Array.isArray(rawLimits)
        ? { ...(rawLimits as Record<string, number>) }
        : {}
    minDishesPerDelivery =
      template.minDishesPerDelivery != null ? template.minDishesPerDelivery : DEFAULT_MIN_DISHES
    maxDishesPerDelivery =
      template.maxDishesPerDelivery != null ? template.maxDishesPerDelivery : DEFAULT_MAX_DISHES
    minDaysPerWeek = template.minDaysPerWeek ?? DEFAULT_MIN_DAYS
    maxDaysPerWeek = template.maxDaysPerWeek ?? DEFAULT_MAX_DAYS
  }

  return {
    allowedCategoryIds,
    categoryLimits,
    minDishesPerDelivery,
    maxDishesPerDelivery,
    minDaysPerWeek,
    maxDaysPerWeek,
  }
}

export type ItemForValidation = { dishId: string; quantity: number }
export type DishWithCategory = { id: string; categoryId: string | null }

/**
 * Проверяет, что список items укладывается в правила плана (категории, лимиты по категории, мин/макс блюд на доставку).
 * Блюда без категории считаются как uncat; если в правилах есть 'uncat' или allowedCategoryIds пустой — разрешаем.
 */
export function validateSubscriptionItemsAgainstPlan(
  items: ItemForValidation[],
  dishes: DishWithCategory[],
  rules: ResolvedPlanRules
): { valid: true } | { valid: false; error: string } {
  const dishById = new Map(dishes.map((d) => [d.id, d]))
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  if (totalQty < rules.minDishesPerDelivery) {
    return {
      valid: false,
      error: `Минимум ${rules.minDishesPerDelivery} блюд на доставку. Сейчас ${totalQty}.`,
    }
  }
  if (totalQty > rules.maxDishesPerDelivery) {
    return {
      valid: false,
      error: `Максимум ${rules.maxDishesPerDelivery} блюд на доставку. Сейчас ${totalQty}.`,
    }
  }
  const perCategory: Record<string, number> = {}
  for (const it of items) {
    const dish = dishById.get(it.dishId)
    if (!dish) continue
    const catId = dish.categoryId ?? 'uncat'
    perCategory[catId] = (perCategory[catId] ?? 0) + it.quantity
  }
  for (const [catId, qty] of Object.entries(perCategory)) {
    if (!rules.allowedCategoryIds.has(catId) && !rules.allowedCategoryIds.has('uncat')) {
      return { valid: false, error: `Категория блюда не входит в план.` }
    }
    const limit = rules.categoryLimits[catId]
    if (limit != null && qty > limit) {
      return {
        valid: false,
        error: `В категории можно не более ${limit} блюд на доставку.`,
      }
    }
  }
  return { valid: true }
}
