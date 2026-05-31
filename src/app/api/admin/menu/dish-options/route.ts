import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const SINGLE_TENANT_RESTAURANT_ID =
  String(process.env.UFO_SINGLE_RESTAURANT_ID || '').trim()

function logDishOptionsDebug(event: string, data: Record<string, unknown>) {
  try {
    const fs = require('fs')
    const path = require('path')
    const logPath = path.join(process.cwd(), '.cursor', 'debug.log')
    fs.appendFileSync(
      logPath,
      JSON.stringify({
        location: 'admin/menu/dish-options',
        event,
        data,
        timestamp: Date.now(),
      }) + '\n'
    )
  } catch {}
}

export async function PUT(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const dishId = typeof body?.dishId === 'string' ? body.dishId : ''
    const values = Array.isArray(body?.values) ? body.values : []
    logDishOptionsDebug('entry', {
      restaurantId: ctx.restaurantId,
      dishId,
      valuesCount: values.length,
    })
    if (!dishId) return NextResponse.json({ ok: false, error: 'dishId обязателен' }, { status: 400 })

    const dish = await prisma.dish.findFirst({
      where: SINGLE_TENANT_RESTAURANT_ID ? { id: dishId } : { id: dishId, restaurantId: ctx.restaurantId },
      select: { id: true, restaurantId: true },
    })
    if (!dish) return NextResponse.json({ ok: false, error: 'блюдо не найдено' }, { status: 404 })
    const effectiveRestaurantId = String(dish.restaurantId || ctx.restaurantId)

    const normalized = values
      .map((v: any, idx: number) => ({
        optionValueId: typeof v?.optionValueId === 'string' ? v.optionValueId : '',
        priceAdjust: Number(v?.priceAdjust ?? 0),
        order: Number.isFinite(Number(v?.order)) ? Math.round(Number(v.order)) : idx,
        isAvailable: v?.isAvailable !== false,
        subscriptionEligible: v?.subscriptionEligible !== false,
        costPrice:
          v?.costPrice === null || typeof v?.costPrice === 'undefined'
            ? null
            : Number.isFinite(Number(v?.costPrice)) && Number(v?.costPrice) > 0
              ? Number(v.costPrice)
              : null,
      }))
      .filter((v: any) => v.optionValueId)
      .slice(0, 40)

    const optionValueIds = [...new Set(normalized.map((v: any) => v.optionValueId))] as string[]
    const allowedValues = optionValueIds.length
      ? await prisma.menuOptionValue.findMany({
          where: SINGLE_TENANT_RESTAURANT_ID
            ? { id: { in: optionValueIds } }
            : {
                id: { in: optionValueIds },
                OR: [
                  { restaurantId: effectiveRestaurantId },
                  { group: { restaurantId: effectiveRestaurantId } },
                ],
              },
          select: { id: true },
        })
      : []
    const allowed = new Set(allowedValues.map((v) => v.id))
    const safe = normalized.filter((v: any) => allowed.has(v.optionValueId))
    logDishOptionsDebug('normalized', {
      restaurantId: ctx.restaurantId,
      dishId,
      normalizedCount: normalized.length,
      uniqueOptionValueIds: optionValueIds.length,
      allowedCount: allowedValues.length,
      safeCount: safe.length,
      rejectedCount: Math.max(0, normalized.length - safe.length),
    })

    // Не затираем привязки, если пришли id из другого ресторана/мусор — иначе «всё пропало».
    if (normalized.length > 0 && safe.length === 0) {
      logDishOptionsDebug('reject_all_filtered', {
        restaurantId: ctx.restaurantId,
        dishId,
        optionValueIds,
      })
      return NextResponse.json({
        ok: true,
        updated: 0,
        warning: 'Выбранные значения опций не найдены — привязки не изменены',
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.dishOptionValue.deleteMany({ where: { dishId } })
      for (const item of safe) {
        await tx.dishOptionValue.create({
          data: {
            restaurantId: effectiveRestaurantId,
            dishId,
            optionValueId: item.optionValueId,
            priceAdjust: new Prisma.Decimal(String(Number.isFinite(item.priceAdjust) ? item.priceAdjust : 0)),
            order: item.order,
            isAvailable: item.isAvailable,
            subscriptionEligible: item.subscriptionEligible !== false,
            ...(item.costPrice != null
              ? { costPrice: new Prisma.Decimal(String(item.costPrice)) }
              : {}),
          },
        })
      }
      await tx.dish.update({ where: { id: dishId }, data: { updatedAt: new Date() } })
    })

    logDishOptionsDebug('success', {
      restaurantId: ctx.restaurantId,
      dishId,
      updatedCount: safe.length,
    })
    return NextResponse.json({ ok: true, updated: safe.length })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    logDishOptionsDebug('error', {
      status,
      message: String(e?.message || e || ''),
      code: String(e?.code || ''),
    })
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
