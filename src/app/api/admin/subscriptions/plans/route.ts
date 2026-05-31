import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { getDefaultPlanBySlug } from '@/lib/subscription-plans'
import { loadSubscriptionPlanTemplates } from '@/lib/subscription-plan-templates-load'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// #region agent log
const DEBUG_LOG_PATH = require('path').join(require('path').resolve(process.cwd()), '.cursor', 'debug.log')
function debugLog(msg: string, data: Record<string, unknown>, hypothesisId: string) {
  try {
    const fs = require('fs')
    const dir = require('path').dirname(DEBUG_LOG_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify({ location: 'admin/plans', message: msg, data, timestamp: Date.now(), hypothesisId }) + '\n')
  } catch {}
}
// #endregion

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    // #region agent log
    debugLog('GET:entry', { restaurantId: ctx.restaurantId }, 'H3')
    // #endregion

    // Дефолтные планы (Standard, Fit, Family) создаются только при первом включении подписок в настройках или по кнопке «восстановить стандартные планы», не при каждом GET — иначе удалённые дефолты «возвращаются».

    const loaded = await loadSubscriptionPlanTemplates({ restaurantId: ctx.restaurantId, activeOnly: false })
    const plans = loaded.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      coverImageUrl: p.coverImageUrl,
      price: p.price,
      plan: p.plan,
      planMode: p.planMode ?? 'READY',
      pricingMode: p.pricingMode ?? 'FIXED',
      menuDiscountPercent: p.menuDiscountPercent == null ? null : Number(p.menuDiscountPercent),
      availablePeriods: Array.isArray(p.availablePeriods) ? p.availablePeriods : [7, 14, 28],
      cycleDaysMin: p.cycleDaysMin ?? null,
      cycleDaysMax: p.cycleDaysMax ?? null,
      configuration: p.configuration ?? null,
      presetSlug: p.presetSlug,
      allowedCategoryIds: p.allowedCategoryIds,
      categoryLimits: p.categoryLimits,
      minDishesPerDelivery: p.minDishesPerDelivery,
      maxDishesPerDelivery: p.maxDishesPerDelivery,
      minDaysPerWeek: p.minDaysPerWeek,
      maxDaysPerWeek: p.maxDaysPerWeek,
      order: typeof p.order === 'number' ? p.order : 0,
      isActive: typeof p.isActive === 'boolean' ? p.isActive : true,
    }))

    // #region agent log
    const planIds = plans.map((x: { id: string }) => x.id)
    debugLog('GET:return', { restaurantId: ctx.restaurantId, plansCount: plans.length, planIds }, 'H3')
    // #endregion

    return NextResponse.json({
      ok: true,
      plans: plans.map((p) => ({
        ...p,
        price: Number(p.price),
        categoryLimits: p.categoryLimits && typeof p.categoryLimits === 'object' ? p.categoryLimits : null,
      })),
    })
  } catch (e: any) {
    // #region agent log
    try{require('fs').appendFileSync(require('path').join(process.cwd(),'.cursor','debug.log'),JSON.stringify({location:'admin/subscriptions/plans:GET',message:'admin plans catch',data:{errMsg:String(e?.message||e),statusCode:e?.statusCode},timestamp:Date.now(),hypothesisId:'H4'})+'\n')}catch{}
    // #endregion
    const status = Number(e?.statusCode || 500)
    const errMsg =
      status === 401
        ? 'Войдите в аккаунт (обновите страницу или откройте приложение заново)'
        : status === 403
          ? 'Нет доступа к этому заведению — выберите точку в профиле'
          : typeof e?.message === 'string' && e.message.length > 0 && e.message.length < 200
            ? e.message
            : 'Не удалось загрузить планы'
    return NextResponse.json({ ok: false, error: errMsg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() || null : null
    const priceRaw = Number(body?.price ?? 0)
    const price = Number.isFinite(priceRaw) ? priceRaw : 0
    const plan = (body?.plan === 'BIWEEKLY' || body?.plan === 'MONTHLY' ? body.plan : 'WEEKLY') as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
    // NOTE: Keep POST compatible with current runtime schema in production.
    // Advanced fields (planMode/pricingMode/menuDiscountPercent/availablePeriods/cycle/configuration)
    // are intentionally ignored here until schema migration is fully applied everywhere.
    const order = typeof body?.order === 'number' ? body.order : 0
    const presetSlug = null

    let allowedCategoryIds = Array.isArray(body?.allowedCategoryIds)
      ? (body.allowedCategoryIds as string[]).filter((x: any) => typeof x === 'string')
      : []
    let categoryLimits =
      body?.categoryLimits && typeof body.categoryLimits === 'object'
        ? (body.categoryLimits as Record<string, number>)
        : undefined
    let minDaysPerWeek =
      typeof body?.minDaysPerWeek === 'number' && Number.isFinite(body.minDaysPerWeek) ? body.minDaysPerWeek : null
    let maxDaysPerWeek =
      typeof body?.maxDaysPerWeek === 'number' && Number.isFinite(body.maxDaysPerWeek) ? body.maxDaysPerWeek : null
    const minDishesPerDelivery =
      typeof body?.minDishesPerDelivery === 'number' && Number.isFinite(body.minDishesPerDelivery) ? body.minDishesPerDelivery : null
    const maxDishesPerDelivery =
      typeof body?.maxDishesPerDelivery === 'number' && Number.isFinite(body.maxDishesPerDelivery) ? body.maxDishesPerDelivery : null

    if (!name) {
      return NextResponse.json({ ok: false, error: 'Укажите название плана' }, { status: 400 })
    }

    const coverImageUrl =
      typeof body?.coverImageUrl === 'string' ? body.coverImageUrl.trim() || null : null

    const created = await prisma.subscriptionPlanTemplate.create({
      data: {
        restaurantId: ctx.restaurantId,
        name,
        description,
        coverImageUrl: coverImageUrl ?? undefined,
        price: new Prisma.Decimal(String(price)),
        plan,
        presetSlug,
        allowedCategoryIds,
        categoryLimits: categoryLimits ?? undefined,
        minDishesPerDelivery: minDishesPerDelivery ?? undefined,
        maxDishesPerDelivery: maxDishesPerDelivery ?? undefined,
        minDaysPerWeek,
        maxDaysPerWeek,
        order,
        isActive: true,
      },
      select: { id: true, name: true, price: true, plan: true, presetSlug: true, order: true, isActive: true },
    })

    return NextResponse.json({
      ok: true,
      plan: { ...created, price: Number(created.price) },
    })
  } catch (e: any) {
    // #region agent log
    try{require('fs').appendFileSync(require('path').join(process.cwd(),'.cursor','debug.log'),JSON.stringify({location:'admin/subscriptions/plans:POST',message:'create plan catch',data:{errMsg:String(e?.message||e),statusCode:e?.statusCode},timestamp:Date.now(),hypothesisId:'H5'})+'\n')}catch{}
    // #endregion
    const status = Number(e?.statusCode || e?.status || 500)
    const msg = String(e?.message || e || 'Ошибка')
    const errMsg = msg.length <= 120 ? msg : status === 403 ? 'Нет доступа' : 'Ошибка создания'
    return NextResponse.json({ ok: false, error: errMsg }, { status: status >= 400 && status < 600 ? status : 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    const existing = await prisma.subscriptionPlanTemplate.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if (typeof body?.description === 'string') data.description = body.description.trim() || null
    if (typeof body?.price === 'number' && Number.isFinite(body.price)) data.price = new Prisma.Decimal(String(body.price))
    if (body?.plan === 'WEEKLY' || body?.plan === 'BIWEEKLY' || body?.plan === 'MONTHLY') data.plan = body.plan
    if (typeof body?.order === 'number') data.order = body.order
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive
    if (Array.isArray(body?.allowedCategoryIds)) {
      data.allowedCategoryIds = (body.allowedCategoryIds as string[]).filter((x: any) => typeof x === 'string')
    }
    if (body?.categoryLimits && typeof body.categoryLimits === 'object') {
      data.categoryLimits = body.categoryLimits as Record<string, number>
    }
    if (typeof body?.minDaysPerWeek === 'number' && Number.isFinite(body.minDaysPerWeek)) {
      data.minDaysPerWeek = body.minDaysPerWeek
    }
    if (typeof body?.maxDaysPerWeek === 'number' && Number.isFinite(body.maxDaysPerWeek)) {
      data.maxDaysPerWeek = body.maxDaysPerWeek
    }
    if (typeof body?.minDishesPerDelivery === 'number' && Number.isFinite(body.minDishesPerDelivery)) {
      data.minDishesPerDelivery = body.minDishesPerDelivery
    }
    if (typeof body?.maxDishesPerDelivery === 'number' && Number.isFinite(body.maxDishesPerDelivery)) {
      data.maxDishesPerDelivery = body.maxDishesPerDelivery
    }
    if (body?.coverImageUrl === null) {
      data.coverImageUrl = null
    } else if (typeof body?.coverImageUrl === 'string') {
      data.coverImageUrl = body.coverImageUrl.trim() || null
    }

    await prisma.subscriptionPlanTemplate.update({
      where: { id },
      data,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    // #region agent log
    debugLog('DELETE:entry', { id, restaurantId: ctx.restaurantId }, 'H1')
    // #endregion
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    const existing = await prisma.subscriptionPlanTemplate.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true, presetSlug: true },
    })
    // #region agent log
    debugLog('DELETE:afterFindFirst', { found: !!existing, id }, 'H1')
    // #endregion
    if (!existing) return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })

    const defaultPresetSlugs = new Set(['standard', 'fit', 'family'])
    const deleteByPreset =
      typeof existing.presetSlug === 'string' && defaultPresetSlugs.has(existing.presetSlug)

    await prisma.$transaction(async (tx) => {
      const idsToDelete = deleteByPreset
        ? (
            await tx.subscriptionPlanTemplate.findMany({
              where: {
                restaurantId: ctx.restaurantId,
                presetSlug: existing.presetSlug,
              },
              select: { id: true },
            })
          ).map((x) => x.id)
        : [id]

      await tx.subscription.updateMany({
        where: { restaurantId: ctx.restaurantId, planTemplateId: { in: idsToDelete } },
        data: { planTemplateId: null },
      })
      await tx.subscriptionPlanTemplate.deleteMany({
        where: { restaurantId: ctx.restaurantId, id: { in: idsToDelete } },
      })
    })

    const checkStillExists = await prisma.subscriptionPlanTemplate.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (checkStillExists) {
      return NextResponse.json({ ok: false, error: 'План не удалён' }, { status: 500 })
    }
    // #region agent log
    debugLog('DELETE:afterDelete', { id }, 'H2')
    // #endregion
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // #region agent log
    debugLog('DELETE:catch', { errMsg: String(e?.message || e), code: e?.code }, 'H2')
    // #endregion
    const status = Number(e?.statusCode || 500)
    const errorMsg =
      status === 401
        ? 'Войдите в аккаунт: откройте ЛК в браузере и войдите, затем повторите удаление.'
        : status === 403
          ? 'Нет доступа к этому заведению.'
          : e?.message && String(e.message).length <= 80
            ? String(e.message)
            : 'Ошибка'
    return NextResponse.json({ ok: false, error: errorMsg }, { status })
  }
}
