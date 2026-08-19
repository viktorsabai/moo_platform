import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PAYLOAD_BYTES = 250_000

function jsonSize(value: unknown): number {
  try { return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8') } catch { return MAX_PAYLOAD_BYTES + 1 }
}

function normalizePayload(value: unknown): Prisma.InputJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Prisma.InputJsonObject
}

async function getContext() {
  return requireRestaurantAdmin(await getRestaurantContext())
}

export async function GET(request: Request) {
  try {
    const ctx = await getContext()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')?.trim()
    if (id) {
      const draft = await prisma.subscriptionMealPlanDraft.findFirst({
        where: { id, restaurantId: ctx.restaurantId },
      })
      if (!draft) return NextResponse.json({ ok: false, error: 'Черновик не найден' }, { status: 404 })
      await prisma.subscriptionMealPlanDraft.update({ where: { id: draft.id }, data: { lastOpenedAt: new Date() } })
      return NextResponse.json({ ok: true, draft })
    }
    const drafts = await prisma.subscriptionMealPlanDraft.findMany({
      where: { restaurantId: ctx.restaurantId, status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    })
    return NextResponse.json({ ok: true, drafts })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'Нет доступа' : 'Не удалось загрузить черновики' }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getContext()
    const body = await request.json().catch(() => ({}))
    const payload = normalizePayload(body?.payload)
    if (jsonSize(payload) > MAX_PAYLOAD_BYTES) return NextResponse.json({ ok: false, error: 'Черновик слишком большой' }, { status: 413 })
    const draft = await prisma.subscriptionMealPlanDraft.create({
      data: {
        restaurantId: ctx.restaurantId,
        createdByUserId: ctx.userId,
        planTemplateId: typeof body?.planTemplateId === 'string' ? body.planTemplateId : null,
        name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'Новый рацион',
        periodDays: Math.max(1, Math.min(90, Number(body?.periodDays) || 7)),
        personCount: Math.max(1, Math.min(20, Number(body?.personCount) || 1)),
        payload,
      },
    })
    return NextResponse.json({ ok: true, draft }, { status: 201 })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'Нет доступа' : 'Не удалось создать черновик' }, { status })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getContext()
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })
    const existing = await prisma.subscriptionMealPlanDraft.findFirst({ where: { id, restaurantId: ctx.restaurantId } })
    if (!existing) return NextResponse.json({ ok: false, error: 'Черновик не найден' }, { status: 404 })
    const hasPayload = body?.payload !== undefined
    const payload = hasPayload ? normalizePayload(body.payload) : undefined
    if (hasPayload && jsonSize(payload) > MAX_PAYLOAD_BYTES) return NextResponse.json({ ok: false, error: 'Черновик слишком большой' }, { status: 413 })
    const draft = await prisma.subscriptionMealPlanDraft.update({
      where: { id: existing.id },
      data: {
        ...(hasPayload ? { payload: payload as Prisma.InputJsonValue } : {}),
        ...(typeof body?.name === 'string' && body.name.trim() ? { name: body.name.trim().slice(0, 120) } : {}),
        ...(body?.periodDays !== undefined ? { periodDays: Math.max(1, Math.min(90, Number(body.periodDays) || 7)) } : {}),
        ...(body?.personCount !== undefined ? { personCount: Math.max(1, Math.min(20, Number(body.personCount) || 1)) } : {}),
        lastOpenedAt: new Date(),
      },
    })
    return NextResponse.json({ ok: true, draft })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'Нет доступа' : 'Не удалось сохранить черновик' }, { status })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getContext()
    const id = new URL(request.url).searchParams.get('id')?.trim()
    if (!id) return NextResponse.json({ ok: false, error: 'id обязателен' }, { status: 400 })
    const result = await prisma.subscriptionMealPlanDraft.deleteMany({ where: { id, restaurantId: ctx.restaurantId, status: 'DRAFT' } })
    if (result.count === 0) return NextResponse.json({ ok: false, error: 'Черновик не найден' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'Нет доступа' : 'Не удалось удалить черновик' }, { status })
  }
}
