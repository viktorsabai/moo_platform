import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({}))
    const kind = body?.kind === 'option' ? 'option' : 'dish'
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const dishId = typeof body?.dishId === 'string' ? body.dishId.trim() : ''
    const raw = body?.costPrice
    const costPrice =
      raw === null || raw === ''
        ? null
        : Number.isFinite(Number(raw)) && Number(raw) > 0
          ? Number(raw)
          : null

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })
    }

    if (kind === 'dish') {
      const dish = await prisma.dish.findFirst({
        where: { id, restaurantId: ctx.restaurantId },
        select: { id: true },
      })
      if (!dish) return NextResponse.json({ ok: false, error: 'блюдо не найдено' }, { status: 404 })
      await prisma.dish.update({
        where: { id: dish.id },
        data: {
          costPrice: costPrice == null ? null : new Prisma.Decimal(String(costPrice)),
        },
      })
      return NextResponse.json({ ok: true, costPrice })
    }

    if (!dishId) {
      return NextResponse.json({ ok: false, error: 'dishId обязателен для опции' }, { status: 400 })
    }
    const link = await prisma.dishOptionValue.findFirst({
      where: {
        restaurantId: ctx.restaurantId,
        dishId,
        optionValueId: id,
      },
      select: { id: true },
    })
    if (!link) return NextResponse.json({ ok: false, error: 'опция не найдена' }, { status: 404 })
    await prisma.dishOptionValue.update({
      where: { id: link.id },
      data: {
        costPrice: costPrice == null ? null : new Prisma.Decimal(String(costPrice)),
      },
    })
    return NextResponse.json({ ok: true, costPrice })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
