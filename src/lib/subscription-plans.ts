/**
 * Default subscription plan presets (Thailand-friendly, commercial naming).
 * Plans define rules and limits by category slug only — no dish lists.
 * Owner creates plans from these presets; categories are matched by slug.
 */

export interface SubscriptionPlanRules {
  /** Category slugs allowed in this plan. Menu categories must match. */
  allowedCategorySlugs: string[]
  /** Max dishes per category per delivery. Key = category slug. */
  categoryLimits: Record<string, number>
  /** Dish tags to exclude (e.g. "heavy" for Fit plan). */
  excludeTags?: string[]
  /** Category slugs to exclude (optional, for heavy categories). */
  excludeCategorySlugs?: string[]
  /** Min dishes per delivery. */
  minDishesPerDelivery: number
  /** Max dishes per delivery. */
  maxDishesPerDelivery: number
  /** Min delivery days per week. */
  minDaysPerWeek: number
  /** Max delivery days per week. */
  maxDaysPerWeek: number
}

export interface DefaultSubscriptionPlan {
  /** Preset identifier for linking (e.g. "standard", "fit", "family"). */
  slug: string
  /** Display name (commercial). */
  name: string
  /** Short description for customers. */
  description: string
  /** Target audience hint. */
  targetAudience: string
  /** Rules and limits. */
  rules: SubscriptionPlanRules
}

/** Default subscription plan presets. Owner selects a preset when creating a plan. */
export const DEFAULT_SUBSCRIPTION_PLANS: DefaultSubscriptionPlan[] = [
  {
    slug: 'standard',
    name: 'Standard',
    description: 'Everyday balanced meals — no thinking required.',
    targetAudience: 'Solo users, daily routine',
    rules: {
      allowedCategorySlugs: ['hot', 'soups', 'salads', 'sides'],
      categoryLimits: {
        hot: 1,
        soups: 1,
        salads: 1,
      },
      minDishesPerDelivery: 1,
      maxDishesPerDelivery: 2,
      minDaysPerWeek: 3,
      maxDaysPerWeek: 5,
    },
  },
  {
    slug: 'fit',
    name: 'Fit',
    description: 'Lighter, balanced meals — feel good and stay active.',
    targetAudience: 'Active lifestyle, health-oriented users',
    rules: {
      allowedCategorySlugs: ['salads', 'cold_snacks', 'light_hot'],
      categoryLimits: {
        salads: 1,
        light_hot: 1,
      },
      excludeTags: ['heavy'],
      minDishesPerDelivery: 1,
      maxDishesPerDelivery: 2,
      minDaysPerWeek: 3,
      maxDaysPerWeek: 5,
    },
  },
  {
    slug: 'family',
    name: 'Family',
    description: 'More food, more variety — shared meals for everyone.',
    targetAudience: 'Couples or families',
    rules: {
      allowedCategorySlugs: ['hot', 'soups', 'snacks'],
      categoryLimits: {
        hot: 2,
        soups: 1,
        snacks: 1,
      },
      minDishesPerDelivery: 2,
      maxDishesPerDelivery: 3,
      minDaysPerWeek: 3,
      maxDaysPerWeek: 6,
    },
  },
]

/** Get plan by slug. */
export function getDefaultPlanBySlug(slug: string): DefaultSubscriptionPlan | undefined {
  return DEFAULT_SUBSCRIPTION_PLANS.find((p) => p.slug === slug)
}

/** Get all plan slugs. */
export function getDefaultPlanSlugs(): string[] {
  return DEFAULT_SUBSCRIPTION_PLANS.map((p) => p.slug)
}

/** Dish-like shape for prefill. */
export interface DishForPrefill {
  id: string
  categoryId: string
  tags?: string[]
}

/** Category with slug for matching. */
export interface CategoryForPrefill {
  id: string
  slug: string
}

/**
 * Returns prefilled dish items for a plan. Never empty — picks first eligible dishes per category up to limits.
 */
export function getPrefilledDishesForPlan(
  planTemplate: { presetSlug?: string | null; allowedCategoryIds?: string[]; categoryLimits?: Record<string, number> | null },
  categories: CategoryForPrefill[],
  dishes: DishForPrefill[],
  presetRules?: SubscriptionPlanRules
): { dishId: string; quantity: number }[] {
  const preset = planTemplate.presetSlug ? getDefaultPlanBySlug(planTemplate.presetSlug) : null
  const rules = presetRules ?? preset?.rules
  if (!rules) {
    const limit = 2
    const seen = new Set<string>()
    return dishes
      .filter((d) => {
        if (seen.has(d.id)) return false
        if (seen.size >= limit) return false
        seen.add(d.id)
        return true
      })
      .slice(0, Math.max(1, limit))
      .map((d) => ({ dishId: d.id, quantity: 1 }))
  }

  const excludeTags = new Set(rules.excludeTags ?? [])
  const slugs = rules.allowedCategorySlugs
  const catBySlug = new Map(categories.map((c) => [c.slug, c]))
  const allowedCatIds = new Set(
    slugs.length > 0 ? slugs.map((s) => catBySlug.get(s)?.id).filter(Boolean) as string[] : categories.map((c) => c.id)
  )
  const limits = rules.categoryLimits
  const minDishes = rules.minDishesPerDelivery
  const maxDishes = rules.maxDishesPerDelivery

  const result: { dishId: string; quantity: number }[] = []
  const usedPerCat: Record<string, number> = {}

  for (const slug of slugs) {
    const catId = catBySlug.get(slug)?.id
    if (!catId || !allowedCatIds.has(catId)) continue
    const limit = limits?.[slug] ?? 1
    const catDishes = dishes.filter(
      (d) =>
        d.categoryId === catId &&
        (excludeTags.size === 0 || !(d.tags ?? []).some((t) => excludeTags.has(t)))
    )
    let n = 0
    for (const d of catDishes) {
      if (n >= limit) break
      result.push({ dishId: d.id, quantity: 1 })
      n++
    }
  }

  if (result.length < minDishes) {
    for (const d of dishes) {
      if (result.length >= maxDishes) break
      if (!allowedCatIds.has(d.categoryId)) continue
      if (excludeTags.size && (d.tags ?? []).some((t) => excludeTags.has(t))) continue
      if (result.some((r) => r.dishId === d.id)) continue
      result.push({ dishId: d.id, quantity: 1 })
    }
  }

  return result.length > 0 ? result : dishes.slice(0, 1).map((d) => ({ dishId: d.id, quantity: 1 }))
}
