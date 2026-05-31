import { prisma } from '@/lib/prisma'

export type RawCheckoutItem = {
  kind?: string
  dishId?: string
  storeVariantId?: string
  quantity?: number
  modifierIds?: string[]
}

export type PricedCheckoutItem = {
  kind: 'dish' | 'store'
  dishId: string
  storeVariantId: string
  name: string
  quantity: number
  unitPrice: number
  modifierIds: string[]
}

export async function computeTrustedItemsAndSubtotal(
  restaurantId: string,
  rawItems: RawCheckoutItem[]
): Promise<{ items: PricedCheckoutItem[]; subtotal: number }> {
  const normalized = (Array.isArray(rawItems) ? rawItems : [])
    .map((it) => {
      const kind = String(it?.kind || '').toLowerCase() === 'store' ? 'store' : 'dish'
      const quantity = Math.max(1, Math.trunc(Number(it?.quantity ?? 1)))
      return {
        kind,
        dishId: String(it?.dishId || '').trim(),
        storeVariantId: String(it?.storeVariantId || '').trim(),
        quantity,
        modifierIds: Array.isArray(it?.modifierIds) ? it.modifierIds.filter((x): x is string => typeof x === 'string') : [],
      }
    })
    .filter((it) => (it.kind === 'store' ? Boolean(it.storeVariantId) : Boolean(it.dishId)))

  const dishIds = [...new Set(normalized.filter((i) => i.kind === 'dish').map((i) => i.dishId))]
  const variantIds = [...new Set(normalized.filter((i) => i.kind === 'store').map((i) => i.storeVariantId))]

  const [dishes, variants] = await Promise.all([
    dishIds.length
      ? prisma.dish.findMany({
          where: { id: { in: dishIds }, restaurantId, isAvailable: true },
          select: { id: true, price: true, name: true },
        })
      : Promise.resolve([] as Array<{ id: string; price: any; name: string }>),
    variantIds.length
      ? prisma.storeVariant.findMany({
          where: { id: { in: variantIds }, restaurantId, isActive: true },
          select: { id: true, price: true, name: true },
        })
      : Promise.resolve([] as Array<{ id: string; price: any; name: string }>),
  ])

  const dishMap = new Map(dishes.map((d) => [d.id, { price: Number(d.price), name: String(d.name || 'Блюдо') }]))
  const variantMap = new Map(variants.map((v) => [v.id, { price: Number(v.price), name: String(v.name || 'Товар') }]))

  const allModifierIds = [...new Set(normalized.flatMap((i) => i.modifierIds))]
  const [modifiers, dishOptionValues] = allModifierIds.length
    ? await Promise.all([
        prisma.dishModifier.findMany({
          where: { id: { in: allModifierIds } },
          select: { id: true, dishId: true, priceAdjust: true },
        }),
        prisma.dishOptionValue.findMany({
          where: {
            optionValueId: { in: allModifierIds },
            restaurantId,
            isAvailable: true,
            optionValue: { isActive: true, group: { isActive: true } },
          },
          select: { optionValueId: true, dishId: true, priceAdjust: true },
        }),
      ])
    : [[], []]
  const modsByDish = new Map<string, Map<string, number>>()
  for (const m of modifiers) {
    if (!modsByDish.has(m.dishId)) modsByDish.set(m.dishId, new Map())
    modsByDish.get(m.dishId)!.set(m.id, Number(m.priceAdjust ?? 0))
  }
  for (const option of dishOptionValues) {
    if (!modsByDish.has(option.dishId)) modsByDish.set(option.dishId, new Map())
    modsByDish.get(option.dishId)!.set(option.optionValueId, Number(option.priceAdjust ?? 0))
  }

  const priced: PricedCheckoutItem[] = []
  for (const it of normalized) {
    if (it.kind === 'store') {
      const base = variantMap.get(it.storeVariantId)
      if (!base || !Number.isFinite(base.price)) continue
      priced.push({ ...it, name: base.name, unitPrice: Number(base.price), kind: 'store' })
      continue
    }
    const baseDish = dishMap.get(it.dishId)
    if (!baseDish || !Number.isFinite(baseDish.price)) continue
    const modMap = modsByDish.get(it.dishId) ?? new Map<string, number>()
    const modsAdjust = it.modifierIds.reduce((sum, id) => sum + Number(modMap.get(id) ?? 0), 0)
    priced.push({ ...it, name: baseDish.name, unitPrice: Math.max(0, Number(baseDish.price) + modsAdjust), kind: 'dish' })
  }

  const subtotal = priced.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)
  return { items: priced, subtotal }
}
