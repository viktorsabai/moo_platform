import { prisma } from '@/lib/prisma'

/** Допустимые id модификаторов/значений опций для блюда (как в гостевом меню и корзине). */
export async function allowedModifierIdsByDish(
  restaurantId: string,
  dishIds: string[],
  candidateModifierIds: string[]
): Promise<Map<string, Set<string>>> {
  const dishIdSet = [...new Set(dishIds.filter(Boolean))]
  const modIds = [...new Set(candidateModifierIds.filter(Boolean))]
  const out = new Map<string, Set<string>>()
  for (const id of dishIdSet) out.set(id, new Set())
  if (!dishIdSet.length || !modIds.length) return out

  const [modifiers, links] = await Promise.all([
    prisma.dishModifier.findMany({
      where: {
        id: { in: modIds },
        dishId: { in: dishIdSet },
        dish: { restaurantId },
      },
      select: { id: true, dishId: true },
    }),
    prisma.dishOptionValue.findMany({
      where: {
        restaurantId,
        dishId: { in: dishIdSet },
        isAvailable: true,
        optionValueId: { in: modIds },
        optionValue: { isActive: true, group: { isActive: true } },
      },
      select: { dishId: true, optionValueId: true },
    }),
  ])

  for (const m of modifiers) {
    out.get(m.dishId)?.add(m.id)
  }
  for (const l of links) {
    out.get(l.dishId)?.add(l.optionValueId)
  }
  return out
}

export function filterModifierIdsForDish(
  allowedByDish: Map<string, Set<string>>,
  dishId: string,
  modifierIds: string[] | null | undefined
): string[] {
  const allow = allowedByDish.get(dishId)
  if (!allow || !modifierIds?.length) return []
  return modifierIds.filter((id) => allow.has(id))
}
