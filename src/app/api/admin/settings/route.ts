import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { DEFAULT_PAYMENT_METHODS, PAYMENT_SLUGS, type PaymentMethodRow } from '@/lib/payment-methods'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const settings = await prisma.appSettings.upsert({
      where: { restaurantId: ctx.restaurantId },
      create: { restaurantId: ctx.restaurantId },
      update: {},
      select: {
        id: true,
        restaurantId: true,
        menuEnabled: true,
        storeEnabled: true,
        subscriptionEnabled: true,
        deliveryFee: true,
        freeDeliveryFrom: true,
        openTime: true,
        closeTime: true,
        isOpenOverride: true,
        paymentMethodsJson: true,
      },
    })

    return NextResponse.json({ ok: true, settings })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const err =
      status === 401
        ? 'Войдите в аккаунт'
        : status === 403
          ? 'Нет доступа к этому заведению'
          : 'Ошибка загрузки'
    return NextResponse.json({ ok: false, error: err }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())

    const body = await request.json().catch(() => ({} as any))

    const data: any = {}
    if (typeof body?.menuEnabled === 'boolean') data.menuEnabled = body.menuEnabled
    if (typeof body?.storeEnabled === 'boolean') data.storeEnabled = body.storeEnabled
    if (typeof body?.subscriptionEnabled === 'boolean') data.subscriptionEnabled = body.subscriptionEnabled
    if (body?.deliveryFee != null && Number.isFinite(Number(body.deliveryFee))) data.deliveryFee = Math.max(0, Math.trunc(Number(body.deliveryFee)))
    if (body?.freeDeliveryFrom != null && Number.isFinite(Number(body.freeDeliveryFrom))) data.freeDeliveryFrom = Math.max(0, Math.trunc(Number(body.freeDeliveryFrom)))
    if (typeof body?.openTime === 'string') data.openTime = body.openTime.trim() || '10:00'
    if (typeof body?.closeTime === 'string') data.closeTime = body.closeTime.trim() || '22:00'
    if (body?.isOpenOverride === null) data.isOpenOverride = null
    if (typeof body?.isOpenOverride === 'boolean') data.isOpenOverride = body.isOpenOverride

    if (Array.isArray(body?.paymentMethods)) {
      const rows: PaymentMethodRow[] = []
      for (const row of body.paymentMethods as unknown[]) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        const slug = String(r.slug || '').trim().toUpperCase()
        if (!PAYMENT_SLUGS.includes(slug as (typeof PAYMENT_SLUGS)[number])) continue
        const rub = r.rubPerThb
        const rubNum = rub == null || rub === '' ? null : Number(rub)
        rows.push({
          slug,
          enabled: Boolean(r.enabled),
          title: String(r.title || slug).trim().slice(0, 120) || slug,
          instruction: r.instruction != null ? String(r.instruction).slice(0, 2000) : null,
          qrImageUrl: r.qrImageUrl != null ? String(r.qrImageUrl).trim().slice(0, 4000) || null : null,
          rubPerThb: rubNum != null && Number.isFinite(rubNum) && rubNum > 0 ? rubNum : null,
        })
      }
      const by = new Map(rows.map((x) => [x.slug, x]))
      const full: PaymentMethodRow[] = DEFAULT_PAYMENT_METHODS.map((d) => ({ ...d, ...(by.get(d.slug) || {}) }))
      data.paymentMethodsJson = full as unknown as object
    }

    const updated = await prisma.appSettings.upsert({
      where: { restaurantId: ctx.restaurantId },
      create: { restaurantId: ctx.restaurantId, ...(Object.keys(data).length ? data : {}) },
      update: data,
      select: {
        id: true,
        restaurantId: true,
        menuEnabled: true,
        storeEnabled: true,
        subscriptionEnabled: true,
        deliveryFee: true,
        freeDeliveryFrom: true,
        openTime: true,
        closeTime: true,
        isOpenOverride: true,
        paymentMethodsJson: true,
      },
    })

    return NextResponse.json({ ok: true, settings: updated })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const raw = String(e?.message || e || '').toLowerCase()
    const isDbError = status === 500 && (raw.includes('denied') || raw.includes('access') || raw.includes('connection') || raw.includes('econnrefused'))
    const errMsg =
      status === 403 ? 'Нет доступа' : status === 401 ? 'Войдите' : isDbError
        ? 'Ошибка базы данных. Проверьте DATABASE_URL.'
        : String(e?.message || e?.code || 'Ошибка')
    return NextResponse.json({ ok: false, error: errMsg }, { status })
  }
}

