/**
 * Ensures 3 boxed plan templates (Standard, Fit, Family) exist for a restaurant.
 * Idempotent — creates each preset if missing (by presetSlug), even when custom plans exist.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getDefaultPlanBySlug } from './subscription-plans'

const DEFAULT_PLANS = [
  { presetSlug: 'standard' as const, name: 'Standard', price: 1290, plan: 'WEEKLY' as const, order: 0 },
  { presetSlug: 'fit' as const, name: 'Fit', price: 1490, plan: 'WEEKLY' as const, order: 1 },
  { presetSlug: 'family' as const, name: 'Family', price: 1990, plan: 'WEEKLY' as const, order: 2 },
]

export async function ensureDefaultPlanTemplatesForRestaurant(restaurantId: string): Promise<void> {
  const categories = await prisma.category.findMany({
    where: { restaurantId },
    select: { id: true, slug: true },
  })
  const slugToId = new Map(categories.map((c) => [c.slug ?? c.id, c.id]))

  for (const p of DEFAULT_PLANS) {
    const exists = await prisma.subscriptionPlanTemplate.findFirst({
      where: { restaurantId, presetSlug: p.presetSlug },
      select: { id: true },
    })
    if (exists) continue

    const preset = getDefaultPlanBySlug(p.presetSlug)
    const rules = preset?.rules
    let allowedCategoryIds: string[] = []
    let categoryLimits: Record<string, number> = {}
    if (rules?.allowedCategorySlugs?.length) {
      allowedCategoryIds = rules.allowedCategorySlugs
        .map((s) => slugToId.get(s))
        .filter((id): id is string => Boolean(id))
      for (const slug of rules.allowedCategorySlugs) {
        const catId = slugToId.get(slug)
        const limit = rules.categoryLimits?.[slug] ?? 1
        if (catId) categoryLimits[catId] = limit
      }
    }

    await prisma.subscriptionPlanTemplate.create({
      data: {
        restaurantId,
        name: p.name,
        description: preset?.description ?? null,
        price: new Prisma.Decimal(String(p.price)),
        plan: p.plan,
        presetSlug: p.presetSlug,
        order: p.order,
        isActive: true,
        allowedCategoryIds: allowedCategoryIds.length > 0 ? allowedCategoryIds : undefined,
        categoryLimits: Object.keys(categoryLimits).length > 0 ? categoryLimits : undefined,
        minDishesPerDelivery: preset?.rules?.minDishesPerDelivery ?? undefined,
        maxDishesPerDelivery: preset?.rules?.maxDishesPerDelivery ?? undefined,
        minDaysPerWeek: preset?.rules?.minDaysPerWeek ?? 3,
        maxDaysPerWeek: preset?.rules?.maxDaysPerWeek ?? 5,
      },
    })
  }
}
