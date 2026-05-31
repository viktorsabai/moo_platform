import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const dishId = typeof body?.dishId === 'string' ? body.dishId : ''
    const options = Array.isArray(body?.options) ? body.options : []
    if (!dishId) return NextResponse.json({ ok: false, error: 'dishId обязателен' }, { status: 400 })

    const dish = await prisma.dish.findFirst({
      where: { id: dishId, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!dish) return NextResponse.json({ ok: false, error: 'блюдо не найдено' }, { status: 404 })

    const normalized = options
      .map((o: any, idx: number) => {
        return {
          name: typeof o?.name === 'string' ? o.name.trim() : '',
          priceAdjust: Number(o?.priceAdjust ?? 0),
          order: Number.isFinite(Number(o?.order)) ? Math.round(Number(o.order)) : idx,
        }
      })
      .filter((o: any) => o.name.length > 0)
      .slice(0, 12)

    await prisma.$transaction(async (tx) => {
      await tx.dishModifier.deleteMany({
        where: { dishId, type: 'OPTION' },
      })
      if (normalized.length > 0) {
        await tx.dishModifier.createMany({
          data: normalized.map((o: any) => ({
            dishId,
            name: o.name,
            type: 'OPTION',
            priceAdjust: new Prisma.Decimal(String(Number.isFinite(o.priceAdjust) ? o.priceAdjust : 0)),
            order: o.order,
          })),
        })
      }
      await tx.dish.update({
        where: { id: dishId },
        data: { updatedAt: new Date() },
      })
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const dishId = typeof body?.dishId === 'string' ? body.dishId : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const type = (body?.type === 'ADD' ? 'ADD' : 'REMOVE') as 'REMOVE' | 'ADD'
    const priceAdjustRaw = Number(body?.priceAdjust ?? 0)
    const priceAdjust = Number.isFinite(priceAdjustRaw) ? priceAdjustRaw : 0
    const order = typeof body?.order === 'number' ? body.order : 0

    if (!dishId || !name) {
      return NextResponse.json({ ok: false, error: 'dishId и name обязательны' }, { status: 400 })
    }

    const dish = await prisma.dish.findFirst({
      where: { id: dishId, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!dish?.id) {
      return NextResponse.json({ ok: false, error: 'блюдо не найдено' }, { status: 400 })
    }

    const created = await prisma.dishModifier.create({
      data: {
        dishId,
        name,
        type,
        priceAdjust: new Prisma.Decimal(String(priceAdjust)),
        order,
      },
      select: { id: true, dishId: true, name: true, type: true, priceAdjust: true, order: true },
    })

    return NextResponse.json({
      ok: true,
      modifier: { ...created, priceAdjust: Number(created.priceAdjust) },
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    const modifier = await prisma.dishModifier.findFirst({
      where: { id },
      include: { dish: { select: { restaurantId: true } } },
    })
    if (!modifier || modifier.dish.restaurantId !== ctx.restaurantId) {
      return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if (body?.type === 'ADD' || body?.type === 'REMOVE') data.type = body.type
    if (typeof body?.priceAdjust === 'number' && Number.isFinite(body.priceAdjust)) data.priceAdjust = new Prisma.Decimal(String(body.priceAdjust))
    if (typeof body?.order === 'number') data.order = body.order
    if (typeof body?.subscriptionEligible === 'boolean') data.subscriptionEligible = body.subscriptionEligible
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'costPrice')) {
      const cp = body?.costPrice
      data.costPrice =
        cp === null || cp === '' || typeof cp === 'undefined'
          ? null
          : typeof cp === 'number' && Number.isFinite(cp) && cp > 0
            ? new Prisma.Decimal(String(cp))
            : null
    }

    await prisma.dishModifier.update({
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
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    const modifier = await prisma.dishModifier.findFirst({
      where: { id },
      include: { dish: { select: { restaurantId: true } } },
    })
    if (!modifier || modifier.dish.restaurantId !== ctx.restaurantId) {
      return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })
    }

    await prisma.dishModifier.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}
