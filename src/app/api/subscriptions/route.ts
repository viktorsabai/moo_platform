import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { buildWebAppUrl, escapeHtml, sendTelegramMessage } from '@/lib/telegram'
import { formatNotificationMessage, notifySubscriptionCreatedToOwner } from '@/lib/notifications'
import { formatPrice, getNearestEventLabel } from '@/lib/utils'
import { getScheduledDeliveryDates } from '@/lib/subscription-deliveries'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { getPlanRules, validateSubscriptionItemsAgainstPlan } from '@/lib/subscription-plan-rules'
import { parseMealSlot } from '@/lib/subscription-meal-slots'
import { allowedModifierIdsByDish, filterModifierIdsForDish } from '@/lib/dish-modifier-sync'
import { resolveApiUser } from '@/lib/tg-auth-resolver'
import { loadSubscriptionConfig } from '@/lib/subscription-config-load'
import { validateSubscriptionItemsByMealSlots } from '@/lib/subscription-meal-slot-rules'
import { calculateSubscriptionQuote } from '@/lib/subscription-pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeWizardDayToJs(day: number): number {
  return day === 6 ? 0 : day + 1
}

export async function GET() {
  const authUser = await resolveApiUser(headers())
  if (!authUser.userId) {
    return NextResponse.json({ error: 'нужна авторизация через telegram' }, { status: 401 })
  }

  const userId = authUser.userId
  const restaurantId = await getConsumerRestaurantId()
  const subs = await prisma.subscription.findMany({
    where: { userId, restaurantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      plan: true,
      status: true,
      price: true,
      deliveryDays: true,
      deliveryTime: true,
      startDate: true,
      nextDelivery: true,
      deliveries: {
        select: { id: true, scheduledDate: true, status: true, deliveredAt: true },
      },
      items: {
        select: {
          id: true,
          dishId: true,
          quantity: true,
          dayOfWeek: true,
          mealSlot: true,
          dish: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              costPrice: true,
              image: true,
              categoryId: true,
              isAvailable: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ ok: true, subscriptions: subs })
}

export async function POST(request: Request) {
  try {
    const authUser = await resolveApiUser(headers())
    const userId = authUser.userId
    const telegramId = authUser.telegramId
    const restaurantId = await getConsumerRestaurantId()
    if (!userId || !telegramId) {
      return NextResponse.json(
        { error: 'Войдите через Telegram: откройте приложение из бота (меню бота → приложение), затем повторите оформление подписки.' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
  const clientRequestId = typeof (body as any)?.clientRequestId === 'string' ? String((body as any).clientRequestId).trim() : ''
  if (clientRequestId) {
    const existing = await prisma.subscription.findFirst({
      where: { userId, restaurantId, clientRequestId },
      select: { id: true },
    })
    if (existing?.id) {
      return NextResponse.json({ ok: true, subscriptionId: existing.id, duplicate: true })
    }
  }

  const name = String(body?.name || 'подписка')
  const plan = String(body?.plan || 'MONTHLY')
  const planTemplateId = typeof (body as any)?.planTemplateId === 'string' ? (body as any).planTemplateId : undefined
  const deliveryDaysRaw: number[] = Array.isArray(body?.deliveryDays)
    ? body.deliveryDays.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n >= 0 && n <= 6)
    : []
  const deliveryDays: number[] = [...new Set(deliveryDaysRaw.map((n) => normalizeWizardDayToJs(n)))].sort((a, b) => a - b)
  const deliveryTime = body?.deliveryTime ? String(body.deliveryTime) : undefined
  const personCountRaw = Number(body?.personCount ?? 1)
  const periodDaysRaw = Number(body?.periodDays ?? 28)

  const subConfig = await loadSubscriptionConfig(restaurantId)
  const settingsRow = await prisma.appSettings.findUnique({
    where: { restaurantId },
    select: { subscriptionEnabled: true },
  })
  if (!settingsRow?.subscriptionEnabled) {
    return NextResponse.json({ ok: false, error: 'Подписки отключены' }, { status: 403 })
  }

  const personCount = Math.max(subConfig.minPersons, Math.min(subConfig.maxPersons, Number.isFinite(personCountRaw) ? Math.round(personCountRaw) : 1))
  const periodDays = subConfig.availablePeriods.includes(periodDaysRaw) ? periodDaysRaw : subConfig.defaultPeriodDays

  let price: number
  type TemplateRow = {
    price: unknown
    plan: string | null
    pricingMode?: string | null
    menuDiscountPercent?: unknown
    configuration?: unknown
    presetSlug: string | null
    allowedCategoryIds: string[]
    categoryLimits: unknown
    minDishesPerDelivery: number | null
    maxDishesPerDelivery: number | null
    minDaysPerWeek: number | null
    maxDaysPerWeek: number | null
  }
  let template: TemplateRow | null = null
  if (planTemplateId) {
    try {
      const row = await prisma.subscriptionPlanTemplate.findFirst({
        where: { id: planTemplateId, restaurantId },
        select: {
          price: true,
          plan: true,
          pricingMode: true,
          menuDiscountPercent: true,
          configuration: true,
          presetSlug: true,
          allowedCategoryIds: true,
          categoryLimits: true,
          minDishesPerDelivery: true,
          maxDishesPerDelivery: true,
          minDaysPerWeek: true,
          maxDaysPerWeek: true,
        },
      })
      template = row as TemplateRow | null
    } catch {
      const row = await prisma.subscriptionPlanTemplate.findFirst({
        where: { id: planTemplateId, restaurantId },
        select: {
          price: true,
          plan: true,
          pricingMode: true,
          menuDiscountPercent: true,
          configuration: true,
          presetSlug: true,
          allowedCategoryIds: true,
          categoryLimits: true,
        },
      })
      template = row as TemplateRow | null
    }
    if (template) {
      const p = Number(template.price)
      const planType = String(template.plan || 'WEEKLY')
      price = planType === 'MONTHLY' ? p : planType === 'BIWEEKLY' ? p * 2.165 : p * 4.33
    } else {
      const priceRaw = Number(body?.price ?? 0)
      price = Number.isFinite(priceRaw) ? priceRaw : 0
    }
  } else {
    const priceRaw = Number(body?.price ?? 0)
    price = Number.isFinite(priceRaw) ? priceRaw : 0
  }

  const startDate = body?.startDate ? new Date(String(body.startDate)) : new Date()
  const nextDelivery = body?.nextDelivery ? new Date(String(body.nextDelivery)) : undefined

  const rawItems = Array.isArray((body as any)?.items) ? ((body as any).items as any[]) : []
  const itemCandidates = rawItems
    .map((it) => {
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
        quantity: Number(it?.quantity ?? 0),
        dayOfWeek,
        mealSlot,
        modifierIds: Array.isArray(it?.modifierIds) ? (it.modifierIds as string[]).filter((x: any) => typeof x === 'string') : [],
      }
    })
    .filter((it) => it.dishId && Number.isFinite(it.quantity) && it.quantity > 0)

  const existingDishes = itemCandidates.length
    ? await prisma.dish.findMany({
        where: { id: { in: itemCandidates.map((i) => i.dishId) }, restaurantId },
        select: { id: true, categoryId: true, isAvailable: true, subscriptionEligible: true, price: true, costPrice: true },
      })
    : []
  const dishIdSet = new Set(existingDishes.map((d) => d.id))
  const itemCreatesRaw = itemCandidates.filter((it) => dishIdSet.has(it.dishId))
  const unavailableDish = existingDishes.find((d) => d.isAvailable === false)
  if (unavailableDish) {
    return NextResponse.json({ ok: false, error: 'В подписку можно добавить только доступные блюда.' }, { status: 400 })
  }
  const notEligibleDish = existingDishes.find((d) => d.subscriptionEligible === false)
  if (notEligibleDish) {
    return NextResponse.json({ ok: false, error: 'В подписку можно добавить только блюда с отметкой "доступно для подписки".' }, { status: 400 })
  }
  let itemCreates = itemCreatesRaw
  try {
    const allModIdsCreate = itemCreatesRaw.flatMap((it) => it.modifierIds)
    const dishIdsCreate = itemCreatesRaw.map((it) => it.dishId)
    const allowedByDishCreate = await allowedModifierIdsByDish(restaurantId, dishIdsCreate, allModIdsCreate)
    itemCreates = itemCreatesRaw.map((it) => ({
      ...it,
      modifierIds: filterModifierIdsForDish(allowedByDishCreate, it.dishId, it.modifierIds),
    }))
  } catch {
    itemCreates = itemCreatesRaw
  }

  const eligibleDishIds = new Set(existingDishes.filter((d) => d.subscriptionEligible && d.isAvailable).map((d) => d.id))
  const mealSlotValidation = validateSubscriptionItemsByMealSlots(
    itemCreates.map((it) => ({ dishId: it.dishId, quantity: it.quantity, mealSlot: it.mealSlot, modifierIds: it.modifierIds })),
    subConfig,
    eligibleDishIds
  )
  if (!mealSlotValidation.valid) {
    return NextResponse.json({ ok: false, error: mealSlotValidation.error }, { status: 400 })
  }

  const minDays = subConfig.minDaysPerWeek
  const maxDays = subConfig.maxDaysPerWeek
  if (deliveryDays.length > 0 && (deliveryDays.length < minDays || deliveryDays.length > maxDays)) {
    return NextResponse.json(
      { ok: false, error: `Дней доставки в неделю: от ${minDays} до ${maxDays}. Сейчас ${deliveryDays.length}.` },
      { status: 400 }
    )
  }

  if (planTemplateId && template) {
    const categories = await prisma.category.findMany({
      where: { restaurantId },
      select: { id: true, slug: true },
    })
    const rules = getPlanRules(template, categories)
    if (itemCreates.length > 0) {
      const validation = validateSubscriptionItemsAgainstPlan(
        itemCreates.map((it) => ({ dishId: it.dishId, quantity: it.quantity })),
        existingDishes.map((d) => ({ id: d.id, categoryId: d.categoryId })),
        rules
      )
      if (!validation.valid) {
        return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
      }
    }
    if (deliveryDays.length > 0 && (deliveryDays.length < rules.minDaysPerWeek || deliveryDays.length > rules.maxDaysPerWeek)) {
      return NextResponse.json(
        { ok: false, error: `Дней доставки в неделю: от ${rules.minDaysPerWeek} до ${rules.maxDaysPerWeek}. Сейчас ${deliveryDays.length}.` },
        { status: 400 }
      )
    }
    const pricingMode = String(template.pricingMode || 'FIXED')
    if (pricingMode === 'MENU' || pricingMode === 'MENU_DISCOUNT') {
      const perDeliveryRetail = itemCreates.reduce((sum, it) => {
        const d = existingDishes.find((x) => x.id === it.dishId)
        return sum + Number(d?.price ?? 0) * it.quantity
      }, 0)
      const deliveriesPerWeek = Math.max(1, deliveryDays.length || rules.minDaysPerWeek || 1)
      const monthlyRetail = perDeliveryRetail * deliveriesPerWeek * 4.33
      const discountPct =
        pricingMode === 'MENU_DISCOUNT'
          ? Math.max(0, Math.min(90, Number(template.menuDiscountPercent ?? 0)))
          : 0
      const monthlyPrice = monthlyRetail * (1 - discountPct / 100)
      price = Math.max(0, Number(monthlyPrice.toFixed(2)))
    }
  }
  const hardOptionIds = Array.isArray((template as any)?.configuration?.hardOptionIds)
    ? new Set(((template as any).configuration.hardOptionIds as unknown[]).map((x) => String(x || '')).filter(Boolean))
    : null
  if (hardOptionIds && hardOptionIds.size > 0) {
    itemCreates = itemCreates.map((it) => ({
      ...it,
      modifierIds: (it.modifierIds || []).filter((id) => hardOptionIds.has(id)),
    }))
  }

  const allModIds = [...new Set(itemCreates.flatMap((it) => it.modifierIds))]
  const [modifiers, optionLinks] = allModIds.length
    ? await Promise.all([
        prisma.dishModifier.findMany({
          where: { id: { in: allModIds }, dish: { restaurantId } },
          select: { id: true, priceAdjust: true, costPrice: true, subscriptionEligible: true },
        }),
        prisma.dishOptionValue.findMany({
          where: { restaurantId, optionValueId: { in: allModIds } },
          select: { optionValueId: true, priceAdjust: true, costPrice: true, subscriptionEligible: true },
        }),
      ])
    : [[], []]

  const dishMap = new Map(
    existingDishes.map((d) => [d.id, { id: d.id, price: Number(d.price), costPrice: d.costPrice == null ? null : Number(d.costPrice) }])
  )
  const modMap = new Map<string, { id: string; priceAdjust: number; costPrice: number | null }>()
  for (const m of modifiers) {
    if (m.subscriptionEligible === false) continue
    modMap.set(m.id, { id: m.id, priceAdjust: Number(m.priceAdjust), costPrice: m.costPrice == null ? null : Number(m.costPrice) })
  }
  for (const o of optionLinks) {
    if (o.subscriptionEligible === false) continue
    modMap.set(o.optionValueId, {
      id: o.optionValueId,
      priceAdjust: Number(o.priceAdjust),
      costPrice: o.costPrice == null ? null : Number(o.costPrice),
    })
  }

  const quote = calculateSubscriptionQuote({
    items: itemCreates.map((it) => ({
      dishId: it.dishId,
      quantity: it.quantity,
      mealSlot: it.mealSlot,
      modifierIds: it.modifierIds,
    })),
    deliveryDaysPerWeek: deliveryDays.length || minDays,
    periodDays,
    personCount,
    commerce: subConfig.commerce,
    dishes: dishMap,
    modifiers: modMap,
    ownerPriceOverride: !planTemplateId ? Number(body?.price ?? 0) || null : null,
  })

  if (!planTemplateId || !template || String(template.pricingMode || 'FIXED') !== 'FIXED') {
    price = quote.guestPrice
  }

  let subscription: { id: string }
  try {
    subscription = await prisma.subscription.create({
      data: {
        ...(clientRequestId ? { clientRequestId } : {}),
        user: { connect: { id: userId } },
        restaurant: { connect: { id: restaurantId } },
        name,
        ...(planTemplateId ? { planTemplate: { connect: { id: planTemplateId } } } : {}),
        plan: plan as any,
        status: 'ACTIVE',
        price: new Prisma.Decimal(String(price)),
        deliveryDays,
        deliveryTime,
        personCount,
        periodDays,
        startDate: Number.isNaN(startDate.getTime()) ? new Date() : startDate,
        nextDelivery: nextDelivery && !Number.isNaN(nextDelivery.getTime()) ? nextDelivery : undefined,
        ...(itemCreates.length
          ? {
              items: {
                create: itemCreates.map((it: (typeof itemCreates)[number]) => {
                  const base: Record<string, unknown> = {
                    quantity: it.quantity,
                    dish: { connect: { id: it.dishId } },
                    modifierIds: it.modifierIds ?? [],
                  }
                  if (it.dayOfWeek != null) base.dayOfWeek = it.dayOfWeek
                  if (it.mealSlot) base.mealSlot = it.mealSlot
                  return base as any
                }),
              },
            }
          : {}),
      },
      select: { id: true },
    })
  } catch (e: any) {
    if (clientRequestId && e?.code === 'P2002') {
      const existing = await prisma.subscription.findFirst({
        where: { userId, restaurantId, clientRequestId },
        select: { id: true },
      })
      if (existing?.id) {
        return NextResponse.json({ ok: true, subscriptionId: existing.id, duplicate: true })
      }
    }
    throw e
  }

  // Create SubscriptionDelivery records for the next 4 weeks
  if (deliveryDays.length > 0) {
    const scheduledDates = getScheduledDeliveryDates(
      deliveryDays,
      nextDelivery && !Number.isNaN(nextDelivery.getTime()) ? nextDelivery : startDate,
      4
    )
    if (scheduledDates.length > 0) {
      await prisma.subscriptionDelivery.createMany({
        data: scheduledDates.map((scheduledDate) => ({
          subscriptionId: subscription.id,
          scheduledDate,
          status: 'SCHEDULED',
        })),
      })
    }
  }

  const bulletLines = rawItems.slice(0, 5).map((it: any) => `• ${escapeHtml(it.name || 'блюдо')} ×${escapeHtml(String(it.quantity ?? 1))}`)
  const nextDeliveryLabel = nextDelivery && !Number.isNaN(nextDelivery.getTime())
    ? getNearestEventLabel(nextDelivery, deliveryTime)
    : undefined
  const msg = formatNotificationMessage({
    emoji: '✅',
    title: 'Подписка создана',
    metricsLine: `«${escapeHtml(name)}» · ${escapeHtml(formatPrice(price))}/мес`,
    bulletLines: bulletLines.length ? bulletLines : undefined,
    closingPhrase: nextDeliveryLabel ? `След. доставка: ${escapeHtml(nextDeliveryLabel)}` : undefined,
  })

  const botToken = await prisma.botIntegration.findFirst({
    where: { restaurantId },
    select: { botToken: true },
  })

  sendTelegramMessage(
    String(telegramId),
    {
      text: msg,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть эту подписку', web_app: { url: buildWebAppUrl(`/subscriptions?subscriptionId=${subscription.id}`) } }],
          [{ text: 'Мои подписки', web_app: { url: buildWebAppUrl('/subscriptions') } }],
          [{ text: 'Открыть mini app', web_app: { url: buildWebAppUrl('/') } }],
        ],
      },
    },
    botToken?.botToken
  ).catch(() => {})

  const userName = authUser.name ?? 'Клиент'
  const itemsSummary = rawItems
    .slice(0, 5)
    .map((it: any) => `${it.quantity}× ${it.name || '—'}`)
    .join(', ')
  notifySubscriptionCreatedToOwner({
    restaurantId,
    subscriptionId: subscription.id,
    userName,
    name,
    price,
    itemsSummary,
    nextDeliveryLabel: nextDeliveryLabel ?? undefined,
  }).catch(() => {})

    return NextResponse.json({
      ok: true,
      subscriptionId: subscription.id,
      economics: {
        perDeliveryRetail: quote.perDeliveryRetail,
        perDeliveryCost: quote.perDeliveryCost,
        perDeliveryMargin: Number((quote.perDeliveryRetail - quote.perDeliveryCost).toFixed(2)),
        perDeliveryMarginPct: quote.ownerMarginPercent,
        periodRetail: quote.periodRetail,
        guestSavings: quote.guestSavings,
        guestSavingsPercent: quote.guestSavingsPercent,
      },
    })
  } catch (e: any) {
    const msg = String(e?.message || e || 'Ошибка сервера')
    const safeMsg = msg.length > 200 ? msg.slice(0, 200) + '…' : msg
    return NextResponse.json(
      { ok: false, error: safeMsg },
      { status: 500 }
    )
  }
}
