import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const sku = typeof body?.sku === 'string' ? body.sku.trim() : null
    const price = Number(body?.price ?? 0)
    const qty = Number(body?.qty ?? 0)
    if (!productId || !name) {
      return NextResponse.json({ ok: false, error: 'productId и name обязательны' }, { status: 400 })
    }
    if (!Number.isFinite(price)) {
      return NextResponse.json({ ok: false, error: 'price некорректен' }, { status: 400 })
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!product?.id) {
      return NextResponse.json({ ok: false, error: 'товар не найден' }, { status: 404 })
    }

    const created = await prisma.storeVariant.create({
      data: {
        restaurantId: ctx.restaurantId,
        productId,
        name,
        sku: sku || null,
        price: new Prisma.Decimal(String(price)),
        qty: Math.max(0, Math.trunc(qty)),
        isActive: body?.isActive === false ? false : true,
      },
      select: { id: true, name: true, price: true, qty: true, isActive: true },
    })
    return NextResponse.json({ ok: true, variant: { ...created, price: Number(created.price) } })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    const data: any = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if (typeof body?.sku === 'string') data.sku = body.sku.trim() || null
    if (body?.price != null && Number.isFinite(Number(body.price))) data.price = new Prisma.Decimal(String(Number(body.price)))
    if (body?.qty != null && Number.isFinite(Number(body.qty))) data.qty = Math.max(0, Math.trunc(Number(body.qty)))
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive

    if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: 'нет полей для обновления' }, { status: 400 })

    const existing = await prisma.storeVariant.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing?.id) return NextResponse.json({ ok: false, error: 'вариант не найден' }, { status: 404 })

    const updated = await prisma.storeVariant.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true, price: true, qty: true, isActive: true },
    })

    return NextResponse.json({ ok: true, variant: { ...updated, price: Number(updated.price) } })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    const existing = await prisma.storeVariant.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'вариант не найден' }, { status: 404 })

    await prisma.storeVariant.delete({
      where: { id: existing.id },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status })
  }
}
