import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { broadcastPublicCampaign } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toDecimalOrNull(v: unknown): Prisma.Decimal | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return new Prisma.Decimal(String(n))
}

/** JSON `null` must not become `Number(null) === 0` (breaks per-user limit checks). */
function parseOptionalUsageLimitTotal(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

/** Omit / null → leave default in DB; never persist 0 from `Number(null)`. */
function parseOptionalUsageLimitPerUser(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n < 1) return undefined
  return n
}

async function maybeBroadcastPublicCampaign(opts: {
  restaurantId: string
  campaignName: string
  campaignCode?: string | null
  validTo?: Date | null
}) {
  await broadcastPublicCampaign(opts)
}

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const rows = await prisma.campaign.findMany({
      where: { restaurantId: ctx.restaurantId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: {
          select: { redemptions: true, orders: true },
        },
      },
    })
    const campaigns = rows.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      kind: c.kind,
      status: c.status,
      visibility: c.visibility,
      targetType: c.targetType,
      rewardType: c.rewardType,
      rewardValue: Number(c.rewardValue),
      rewardCap: c.rewardCap != null ? Number(c.rewardCap) : null,
      giftTitle: c.giftTitle,
      minSubtotal: c.minSubtotal != null ? Number(c.minSubtotal) : null,
      firstOrderOnly: c.firstOrderOnly,
      validFrom: c.validFrom?.toISOString() ?? null,
      validTo: c.validTo?.toISOString() ?? null,
      assignedTelegramId: c.assignedTelegramId,
      metadataJson: c.metadataJson,
      notifyOnPublish: c.notifyOnPublish,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      _count: c._count,
    }))
    return NextResponse.json({ ok: true, campaigns })
  } catch (e: any) {
    const code = String(e?.code || '')
    const msg = String(e?.message || '')
    if (code === 'P2021' || /table .* does not exist/i.test(msg) || msg.includes('Campaign does not exist')) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'В базе нет таблиц акций. Выполните: npm run db:apply-campaign-sql или prisma migrate deploy.',
        },
        { status: 503 },
      )
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'Ошибка' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const name = String(body?.name || '').trim()
    if (!name) return NextResponse.json({ ok: false, error: 'name обязателен' }, { status: 400 })
    const codeRaw = String(body?.code || '').trim().toUpperCase()
    const code = codeRaw || null
    const validFrom =
      body?.validFrom && String(body.validFrom).trim() ? new Date(String(body.validFrom)) : null
    const validTo = body?.validTo && String(body.validTo).trim() ? new Date(String(body.validTo)) : null
    if (validFrom && Number.isNaN(validFrom.getTime())) {
      return NextResponse.json({ ok: false, error: 'некорректная дата «с»' }, { status: 400 })
    }
    if (validTo && Number.isNaN(validTo.getTime())) {
      return NextResponse.json({ ok: false, error: 'некорректная дата «по»' }, { status: 400 })
    }

    const created = await prisma.campaign.create({
      data: {
        restaurantId: ctx.restaurantId,
        name,
        code,
        kind: body?.kind === 'AUTO' ? 'AUTO' : 'PROMOCODE',
        status: body?.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
        visibility: body?.visibility === 'HIDDEN' ? 'HIDDEN' : body?.visibility === 'ASSIGNED_ONLY' ? 'ASSIGNED_ONLY' : 'PUBLIC',
        targetType:
          body?.targetType === 'DELIVERY_FEE' || body?.targetType === 'CATEGORY' || body?.targetType === 'ITEM'
            ? body.targetType
            : 'ORDER_TOTAL',
        rewardType: body?.rewardType === 'PERCENT' ? 'PERCENT' : body?.rewardType === 'GIFT' ? 'GIFT' : 'FIXED',
        rewardValue: toDecimalOrNull(body?.rewardValue) || new Prisma.Decimal('0'),
        rewardCap: toDecimalOrNull(body?.rewardCap),
        giftTitle: String(body?.giftTitle || '').trim() || null,
        giftPayloadJson: body?.giftPayloadJson ?? null,
        minSubtotal: toDecimalOrNull(body?.minSubtotal),
        firstOrderOnly: Boolean(body?.firstOrderOnly),
        usageLimitTotal: parseOptionalUsageLimitTotal(body?.usageLimitTotal),
        usageLimitPerUser: parseOptionalUsageLimitPerUser(body?.usageLimitPerUser),
        assignedUserId: String(body?.assignedUserId || '').trim() || null,
        assignedTelegramId: String(body?.assignedTelegramId || '').trim() || null,
        validFrom,
        validTo,
        metadataJson: body?.metadataJson ?? null,
        notifyOnPublish: Boolean(body?.notifyOnPublish),
      },
      include: { _count: { select: { redemptions: true, orders: true } } },
    })
    if (created.status === 'ACTIVE' && created.visibility === 'PUBLIC' && created.notifyOnPublish) {
      // Do not block the HTTP response: large fan-out can exceed serverless timeouts and the
      // client would never get `{ ok: true }` or run `load()` even though the row exists.
      void maybeBroadcastPublicCampaign({
        restaurantId: ctx.restaurantId,
        campaignName: created.name,
        campaignCode: created.code,
        validTo: created.validTo,
      }).catch((err) => console.error('[campaigns:POST:broadcast]', err))
    }
    // Явная сериализация: сырые Decimal/Date из Prisma иногда ломали JSON-ответ в serverless — клиент
    // получал пустое/битое тело, сбрасывал форму без `ok` и без тоста.
    const campaignJson = {
      id: created.id,
      name: created.name,
      code: created.code,
      kind: created.kind,
      status: created.status,
      visibility: created.visibility,
      targetType: created.targetType,
      rewardType: created.rewardType,
      rewardValue: Number(created.rewardValue),
      rewardCap: created.rewardCap != null ? Number(created.rewardCap) : null,
      giftTitle: created.giftTitle,
      minSubtotal: created.minSubtotal != null ? Number(created.minSubtotal) : null,
      firstOrderOnly: created.firstOrderOnly,
      validFrom: created.validFrom?.toISOString() ?? null,
      validTo: created.validTo?.toISOString() ?? null,
      assignedTelegramId: created.assignedTelegramId,
      metadataJson: created.metadataJson,
      notifyOnPublish: created.notifyOnPublish,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      _count: created._count,
    }
    return NextResponse.json({ ok: true, campaign: campaignJson })
  } catch (e: any) {
    const code = String(e?.code || '')
    const msg = String(e?.message || '')
    if (code === 'P2002' || msg.toLowerCase().includes('unique constraint')) {
      return NextResponse.json(
        { ok: false, error: 'Такой промокод уже есть у этого заведения — измените код' },
        { status: 409 },
      )
    }
    if (code === 'P2021' || /table .* does not exist/i.test(msg) || msg.includes('Campaign does not exist')) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'В базе нет таблиц акций. Выполните SQL-миграцию: npm run db:apply-campaign-sql (или prisma migrate deploy, если миграции уже ведёте с продакшена).',
        },
        { status: 503 },
      )
    }
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: msg || 'Ошибка' }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })
    const existing = await prisma.campaign.findFirst({ where: { id, restaurantId: ctx.restaurantId } })
    if (!existing) return NextResponse.json({ ok: false, error: 'не найдено' }, { status: 404 })

    const data: Prisma.CampaignUpdateInput = {}
    if (typeof body?.name === 'string') data.name = body.name.trim()
    if (typeof body?.code === 'string') data.code = body.code.trim().toUpperCase() || null
    if (body?.kind === 'PROMOCODE' || body?.kind === 'AUTO') data.kind = body.kind
    if (body?.status === 'DRAFT' || body?.status === 'ACTIVE' || body?.status === 'PAUSED' || body?.status === 'EXPIRED' || body?.status === 'ARCHIVED') data.status = body.status
    if (body?.visibility === 'PUBLIC' || body?.visibility === 'HIDDEN' || body?.visibility === 'ASSIGNED_ONLY') data.visibility = body.visibility
    if (body?.targetType === 'ORDER_TOTAL' || body?.targetType === 'DELIVERY_FEE' || body?.targetType === 'CATEGORY' || body?.targetType === 'ITEM') data.targetType = body.targetType
    if (body?.rewardType === 'FIXED' || body?.rewardType === 'PERCENT' || body?.rewardType === 'GIFT') data.rewardType = body.rewardType
    if (body?.rewardValue !== undefined) data.rewardValue = toDecimalOrNull(body.rewardValue) || new Prisma.Decimal('0')
    if (body?.rewardCap !== undefined) data.rewardCap = toDecimalOrNull(body.rewardCap)
    if (body?.giftTitle !== undefined) data.giftTitle = String(body.giftTitle || '').trim() || null
    if (body?.giftPayloadJson !== undefined) data.giftPayloadJson = body.giftPayloadJson ?? Prisma.JsonNull
    if (body?.minSubtotal !== undefined) data.minSubtotal = toDecimalOrNull(body.minSubtotal)
    if (body?.firstOrderOnly !== undefined) data.firstOrderOnly = Boolean(body.firstOrderOnly)
    if (body?.usageLimitTotal !== undefined) data.usageLimitTotal = parseOptionalUsageLimitTotal(body.usageLimitTotal)
    if (body?.usageLimitPerUser !== undefined) {
      const per = parseOptionalUsageLimitPerUser(body.usageLimitPerUser)
      data.usageLimitPerUser = per === undefined ? null : per
    }
    if (body?.assignedUserId !== undefined) {
      const assignedUserId = String(body.assignedUserId || '').trim()
      data.assignedUser = assignedUserId ? { connect: { id: assignedUserId } } : { disconnect: true }
    }
    if (body?.assignedTelegramId !== undefined) data.assignedTelegramId = String(body.assignedTelegramId || '').trim() || null
    if (body?.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(String(body.validFrom)) : null
    if (body?.validTo !== undefined) data.validTo = body.validTo ? new Date(String(body.validTo)) : null
    if (body?.metadataJson !== undefined) data.metadataJson = body.metadataJson ?? Prisma.JsonNull
    if (body?.notifyOnPublish !== undefined) data.notifyOnPublish = Boolean(body.notifyOnPublish)

    const updated = await prisma.campaign.update({
      where: { id },
      data,
      include: { _count: { select: { redemptions: true, orders: true } } },
    })
    const wasNotActive = existing.status !== 'ACTIVE'
    if (wasNotActive && updated.status === 'ACTIVE' && updated.visibility === 'PUBLIC' && updated.notifyOnPublish) {
      void maybeBroadcastPublicCampaign({
        restaurantId: ctx.restaurantId,
        campaignName: updated.name,
        campaignCode: updated.code,
        validTo: updated.validTo,
      }).catch((err) => console.error('[campaigns:PATCH:broadcast]', err))
    }
    return NextResponse.json({ ok: true, campaign: updated })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: String(e?.message || 'Ошибка') }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })
    const existing = await prisma.campaign.findFirst({ where: { id, restaurantId: ctx.restaurantId }, select: { id: true } })
    if (!existing) return NextResponse.json({ ok: false, error: 'не найдено' }, { status: 404 })
    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: String(e?.message || 'Ошибка') }, { status })
  }
}
