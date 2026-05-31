import { NextResponse } from 'next/server'
import { allowedModifierIdsByDish, filterModifierIdsForDish } from '@/lib/dish-modifier-sync'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import {
  notifySubscriptionStatusChangedToCustomer,
  notifySubscriptionStatusChangedToOwner,
} from '@/lib/notifications'
import { canEditSubscription } from '@/lib/subscription-rules'
import { getPlanRules, validateSubscriptionItemsAgainstPlan } from '@/lib/subscription-plan-rules'
import { parseMealSlot } from '@/lib/subscription-meal-slots'
import { resolveApiUser } from '@/lib/tg-auth-resolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'] as const

async function getSubscriptionContext(id: string, needsItems = false, needsUser = false) {
  const authUser = await resolveApiUser(headers())
  if (!authUser.userId) return { error: 'нужна авторизация', status: 401 as const }
  const restaurantId = await getConsumerRestaurantId()
  const sub = await prisma.subscription.findFirst({
    where: { id, userId: authUser.userId, restaurantId },
    select:
      needsItems || needsUser
        ? {
            id: true,
            status: true,
            name: true,
            plan: true,
            price: true,
            deliveryDays: true,
            deliveryTime: true,
            nextDelivery: true,
            ...(needsUser && { user: { select: { telegramId: true, name: true, telegramFirstName: true } } }),
            ...(needsItems && {
              items: {
                select: {
                  dishId: true,
                  quantity: true,
                  dayOfWeek: true,
                  mealSlot: true,
                  modifierIds: true,
                  dish: { select: { id: true, name: true, price: true, image: true } },
                },
              },
              deliveries: {
                select: { id: true, scheduledDate: true, status: true, deliveredAt: true },
              },
            }),
          }
        : { id: true, status: true, nextDelivery: true },
  })
  if (!sub) return { error: 'подписка не найдена', status: 404 as const }
  return { subscription: sub, userId: authUser.userId, restaurantId }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getSubscriptionContext(id, true)
  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  }
  const sub = result.subscription as any
  const rawItems = sub.items ?? []
  let allowedByDish = new Map<string, Set<string>>()
  try {
    const allModIds = rawItems.flatMap((it: any) => (Array.isArray(it.modifierIds) ? it.modifierIds : []))
    const dishIds = rawItems.map((it: any) => String(it.dishId || '')).filter(Boolean)
    allowedByDish = await allowedModifierIdsByDish(result.restaurantId, dishIds, allModIds)
  } catch {
    for (const it of rawItems) {
      const id = String(it.dishId || '')
      if (!id) continue
      const prev = allowedByDish.get(id) ?? new Set<string>()
      for (const m of Array.isArray(it.modifierIds) ? it.modifierIds : []) {
        if (typeof m === 'string') prev.add(m)
      }
      allowedByDish.set(id, prev)
    }
  }

  const out = {
    ...sub,
    price: sub.price ? Number(sub.price) : 0,
    items: rawItems.map((it: any) => ({
      ...it,
      modifierIds: filterModifierIdsForDish(allowedByDish, String(it.dishId || ''), it.modifierIds),
      dish: it.dish ? { ...it.dish, price: Number(it.dish.price ?? 0) } : it.dish,
    })),
  }
  return NextResponse.json({ ok: true, subscription: out })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getSubscriptionContext(id)
  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  }
  const sub = result.subscription as any
  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = {}

  const rawItems = Array.isArray((body as any)?.items) ? (body as any).items : null
  const deliveryDays = Array.isArray((body as any)?.deliveryDays)
    ? (body as any).deliveryDays.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n >= 0 && n <= 6)
    : null
  const wantsToEditComposition = rawItems !== null || (deliveryDays !== null && (deliveryDays?.length ?? 0) > 0)

  if (wantsToEditComposition) {
    const canEdit = canEditSubscription(
      { status: sub.status, nextDelivery: sub.nextDelivery },
      new Date()
    )
    if (!canEdit) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Изменения недоступны: прошёл cutoff (12ч до доставки). Изменения применятся только к будущим доставкам.',
        },
        { status: 403 }
      )
    }
  }

  const status = typeof body?.status === 'string' ? String(body.status).toUpperCase() : ''
  if (status) {
    if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json({ ok: false, error: 'invalid status' }, { status: 400 })
    }
    update.status = status
  }

  if (rawItems !== null) {
    type RawItem = { dishId?: string; quantity?: number; dayOfWeek?: number; mealSlot?: string; modifierIds?: string[] }
    type Candidate = { dishId: string; quantity: number; dayOfWeek: number | null; mealSlot: string | null; modifierIds: string[] }
    const itemCandidates = (rawItems as RawItem[])
      .map((it: RawItem): Candidate => {
        const dw = it?.dayOfWeek
        const dayOfWeek =
          dw === null || dw === undefined
            ? null
            : Number(dw) >= 0 && Number(dw) <= 6
              ? Number(dw)
              : null
        const mealSlot = parseMealSlot(it?.mealSlot)
        return {
          dishId: typeof it?.dishId === 'string' ? it.dishId : '',
          quantity: Math.max(1, Math.min(10, Number(it?.quantity ?? 1) || 1)),
          dayOfWeek,
          mealSlot,
          modifierIds: Array.isArray(it?.modifierIds) ? (it.modifierIds as string[]).filter((x: string) => typeof x === 'string') : [],
        }
      })
      .filter((it: Candidate) => it.dishId)
    const existingDishes = itemCandidates.length
      ? await prisma.dish.findMany({
          where: { id: { in: itemCandidates.map((i: Candidate) => i.dishId) }, restaurantId: result.restaurantId },
          select: { id: true, categoryId: true },
        })
      : []
    const dishIdSet = new Set(existingDishes.map((d) => d.id))
    const validItems = itemCandidates.filter((it) => dishIdSet.has(it.dishId))

    const subWithTemplate = await prisma.subscription.findFirst({
      where: { id, userId: result.userId, restaurantId: result.restaurantId },
      select: {
        planTemplate: {
          select: {
            presetSlug: true,
            allowedCategoryIds: true,
            categoryLimits: true,
            minDishesPerDelivery: true,
            maxDishesPerDelivery: true,
            minDaysPerWeek: true,
            maxDaysPerWeek: true,
          },
        },
      },
    })
    const planTemplate = subWithTemplate?.planTemplate ?? null
    let itemsToSave = validItems
    try {
      const allModIds = validItems.flatMap((it: Candidate) => it.modifierIds)
      const dishIdsForMods = validItems.map((it: Candidate) => it.dishId)
      const allowedByDish = await allowedModifierIdsByDish(result.restaurantId, dishIdsForMods, allModIds)
      itemsToSave = validItems.map((it: Candidate) => ({
        ...it,
        modifierIds: filterModifierIdsForDish(allowedByDish, it.dishId, it.modifierIds),
      }))
    } catch {
      itemsToSave = validItems
    }

    if (planTemplate && itemsToSave.length > 0) {
      const categories = await prisma.category.findMany({
        where: { restaurantId: result.restaurantId },
        select: { id: true, slug: true },
      })
      const rules = getPlanRules(planTemplate as import('@/lib/subscription-plan-rules').PlanTemplateForRules, categories)
      const validation = validateSubscriptionItemsAgainstPlan(
        itemsToSave.map((it: Candidate) => ({ dishId: it.dishId, quantity: it.quantity })),
        existingDishes.map((d) => ({ id: d.id, categoryId: d.categoryId })),
        rules
      )
      if (!validation.valid) {
        return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionItem.deleteMany({ where: { subscriptionId: id } })
      if (itemsToSave.length > 0) {
        await tx.subscriptionItem.createMany({
          data: itemsToSave.map((it: Candidate) => {
            const base: Record<string, unknown> = {
              subscriptionId: id,
              dishId: it.dishId,
              quantity: it.quantity,
              modifierIds: it.modifierIds ?? [],
            }
            if (it.dayOfWeek != null) base.dayOfWeek = it.dayOfWeek
            if (it.mealSlot) base.mealSlot = it.mealSlot
            return base as any
          }),
        })
      }
    })
  }

  if (deliveryDays && deliveryDays.length > 0) {
    const subWithPlan = await prisma.subscription.findFirst({
      where: { id, userId: result.userId, restaurantId: result.restaurantId },
      select: {
        planTemplate: {
          select: {
            presetSlug: true,
            allowedCategoryIds: true,
            categoryLimits: true,
            minDishesPerDelivery: true,
            maxDishesPerDelivery: true,
            minDaysPerWeek: true,
            maxDaysPerWeek: true,
          },
        },
      },
    })
    const planForDays = subWithPlan?.planTemplate ?? null
    if (planForDays) {
      const categories = await prisma.category.findMany({
        where: { restaurantId: result.restaurantId },
        select: { id: true, slug: true },
      })
      const rules = getPlanRules(planForDays as import('@/lib/subscription-plan-rules').PlanTemplateForRules, categories)
      if (deliveryDays.length < rules.minDaysPerWeek || deliveryDays.length > rules.maxDaysPerWeek) {
        return NextResponse.json(
          {
            ok: false,
            error: `Дней доставки в неделю: от ${rules.minDaysPerWeek} до ${rules.maxDaysPerWeek}. Сейчас ${deliveryDays.length}.`,
          },
          { status: 400 }
        )
      }
    }
    update.deliveryDays = deliveryDays
  }

  if (!status && rawItems === null && deliveryDays === null) {
    return NextResponse.json({ ok: false, error: 'nothing to update' }, { status: 400 })
  }

  if (Object.keys(update).length > 0) {
    const prevResult = status ? await getSubscriptionContext(id, false, true) : null
    const prevSub = prevResult && !('error' in prevResult) ? (prevResult as any).subscription : null

    await prisma.subscription.update({
      where: { id },
      data: update as any,
    })

    if (status && prevSub) {
      const userName = (prevSub.user as any)?.name ?? (prevSub.user as any)?.telegramFirstName ?? 'Клиент'
      notifySubscriptionStatusChangedToCustomer({
        restaurantId: result.restaurantId,
        subscriptionId: id,
        subscriptionName: prevSub.name ?? 'Подписка',
        status,
        customerTelegramId: (prevSub.user as any)?.telegramId ?? null,
      }).catch(() => {})
      notifySubscriptionStatusChangedToOwner({
        restaurantId: result.restaurantId,
        subscriptionId: id,
        subscriptionName: prevSub.name ?? 'Подписка',
        status,
        userName,
      }).catch(() => {})
    }
  }
  return NextResponse.json({ ok: true, ...(status ? { status } : {}) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await getSubscriptionContext(id)
  if ('error' in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
  }
  await prisma.subscription.delete({
    where: { id },
  })
  return NextResponse.json({ ok: true })
}
