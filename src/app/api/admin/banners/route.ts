import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { getDefaultPlanBySlug } from '@/lib/subscription-plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const banners = await prisma.homeBanner.findMany({
      where: { restaurantId: ctx.restaurantId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        href: true,
        cta: true,
        type: true,
        targetType: true,
        targetId: true,
        order: true,
        isActive: true,
      },
    })

    return NextResponse.json({ ok: true, banners })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const fromPlanId = typeof body?.fromPlanId === 'string' ? body.fromPlanId.trim() : null

    let title = typeof body?.title === 'string' ? body.title.trim() : ''
    let description = typeof body?.description === 'string' ? body.description.trim() : null
    const image = typeof body?.image === 'string' ? body.image.trim() : null
    let href = typeof body?.href === 'string' ? body.href.trim() : ''
    const cta = typeof body?.cta === 'string' ? body.cta.trim() : 'Открыть'
    const type = (body?.type === 'reel' ? 'reel' : 'chip') as 'chip' | 'reel'
    const targetType = typeof body?.targetType === 'string' ? body.targetType.trim() : null
    const targetId = typeof body?.targetId === 'string' ? body.targetId.trim() : null
    let order = typeof body?.order === 'number' ? body.order : 0

    if (fromPlanId) {
      const plan = await prisma.subscriptionPlanTemplate.findFirst({
        where: { id: fromPlanId, restaurantId: ctx.restaurantId },
        select: { id: true, name: true, presetSlug: true },
      })
      if (!plan) return NextResponse.json({ ok: false, error: 'План не найден' }, { status: 404 })
      const preset = plan.presetSlug ? getDefaultPlanBySlug(plan.presetSlug) : null
      title = plan.name
      description = preset?.description ?? `Подписка ${plan.name}`
      href = `/subscriptions/new?plan=${plan.id}`
      const maxOrder = await prisma.homeBanner.aggregate({
        where: { restaurantId: ctx.restaurantId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    if (!title || !href) {
      return NextResponse.json({ ok: false, error: 'title и href обязательны' }, { status: 400 })
    }

    const created = await prisma.homeBanner.create({
      data: {
        restaurantId: ctx.restaurantId,
        title,
        description: description || undefined,
        image: image || undefined,
        href: href || '/menu',
        cta: cta || 'Открыть',
        type,
        targetType: targetType || undefined,
        targetId: targetId || undefined,
        order,
      },
      select: { id: true, title: true, href: true, type: true, order: true, isActive: true },
    })

    return NextResponse.json({ ok: true, banner: created })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const errMsg = status === 403 ? 'Нет доступа' : status === 401 ? 'Войдите' : String(e?.message || e?.code || 'Ошибка')
    return NextResponse.json({ ok: false, error: errMsg }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })

    const existing = await prisma.homeBanner.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body?.title === 'string') data.title = body.title.trim()
    if (typeof body?.description === 'string') data.description = body.description.trim() || null
    if (typeof body?.image === 'string') data.image = body.image.trim() || null
    if (typeof body?.href === 'string') data.href = body.href.trim()
    if (typeof body?.cta === 'string') data.cta = body.cta.trim()
    if (body?.type === 'reel' || body?.type === 'chip') data.type = body.type
    if (typeof body?.targetType === 'string') data.targetType = body.targetType.trim() || null
    if (typeof body?.targetId === 'string') data.targetId = body.targetId.trim() || null
    if (typeof body?.order === 'number') data.order = body.order
    if (typeof body?.isActive === 'boolean') data.isActive = body.isActive

    await prisma.homeBanner.update({
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

    const existing = await prisma.homeBanner.findFirst({
      where: { id, restaurantId: ctx.restaurantId },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ ok: false, error: 'не найден' }, { status: 404 })

    await prisma.homeBanner.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: 'Ошибка' }, { status })
  }
}
