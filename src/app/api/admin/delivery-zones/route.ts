import { NextResponse } from 'next/server'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { ensureMvpTables, newId } from '@/lib/mvp-db'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 30)
}

function normalizePolygonJson(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null
  try {
    const parsed = JSON.parse(input)
    if (parsed?.type !== 'Polygon' || !Array.isArray(parsed?.coordinates?.[0])) return null
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    await ensureMvpTables()
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        name: string
        polygonJson: string | null
        keywords: string[] | null
        zipCodes: string[] | null
        deliveryFee: number
        minOrderAmount: number
        deliveryWindowMin: number
        isActive: boolean
        sortOrder: number
      }>
    >(
      `SELECT "id","name","polygonJson","keywords","zipCodes","deliveryFee","minOrderAmount","deliveryWindowMin","isActive","sortOrder"
       FROM "DeliveryZone"
       WHERE "restaurantId" = $1
       ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      ctx.restaurantId
    )
    return NextResponse.json({ ok: true, zones: rows })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Не удалось загрузить зоны доставки' }, { status: Number(e?.statusCode || 500) })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    await ensureMvpTables()
    const body = await request.json().catch(() => ({} as any))
    const id = newId('zone')
    const name = String(body?.name || '').trim() || 'Новая зона'
    const polygonJson = normalizePolygonJson(body?.polygonJson)
    const keywords = normalizeList(body?.keywords)
    const zipCodes = normalizeList(body?.zipCodes)
    const deliveryFee = Math.max(0, Math.trunc(Number(body?.deliveryFee ?? 0)))
    const minOrderAmount = Math.max(0, Math.trunc(Number(body?.minOrderAmount ?? 0)))
    const deliveryWindowMin = Math.max(10, Math.trunc(Number(body?.deliveryWindowMin ?? 60)))

    await prisma.$executeRawUnsafe(
      `INSERT INTO "DeliveryZone"
       ("id","restaurantId","name","polygonJson","keywords","zipCodes","deliveryFee","minOrderAmount","deliveryWindowMin","isActive","sortOrder")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,0)`,
      id,
      ctx.restaurantId,
      name,
      polygonJson,
      keywords,
      zipCodes,
      deliveryFee,
      minOrderAmount,
      deliveryWindowMin
    )
    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Не удалось создать зону доставки' }, { status: Number(e?.statusCode || 500) })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    await ensureMvpTables()
    const body = await request.json().catch(() => ({} as any))
    const id = String(body?.id || '').trim()
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
    const name = String(body?.name || '').trim() || 'Зона'
    const polygonJson = normalizePolygonJson(body?.polygonJson)
    const keywords = normalizeList(body?.keywords)
    const zipCodes = normalizeList(body?.zipCodes)
    const deliveryFee = Math.max(0, Math.trunc(Number(body?.deliveryFee ?? 0)))
    const minOrderAmount = Math.max(0, Math.trunc(Number(body?.minOrderAmount ?? 0)))
    const deliveryWindowMin = Math.max(10, Math.trunc(Number(body?.deliveryWindowMin ?? 60)))
    const isActive = Boolean(body?.isActive ?? true)
    const sortOrder = Math.max(0, Math.trunc(Number(body?.sortOrder ?? 0)))

    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "DeliveryZone"
       SET "name"=$1,"polygonJson"=$2,"keywords"=$3,"zipCodes"=$4,"deliveryFee"=$5,"minOrderAmount"=$6,
           "deliveryWindowMin"=$7,"isActive"=$8,"sortOrder"=$9,"updatedAt"=NOW()
       WHERE "id"=$10 AND "restaurantId"=$11`,
      name,
      polygonJson,
      keywords,
      zipCodes,
      deliveryFee,
      minOrderAmount,
      deliveryWindowMin,
      isActive,
      sortOrder,
      id,
      ctx.restaurantId
    )
    if (!updated) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Не удалось обновить зону доставки' }, { status: Number(e?.statusCode || 500) })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    await ensureMvpTables()
    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
    await prisma.$executeRawUnsafe(`DELETE FROM "DeliveryZone" WHERE "id"=$1 AND "restaurantId"=$2`, id, ctx.restaurantId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Не удалось удалить зону доставки' }, { status: Number(e?.statusCode || 500) })
  }
}
