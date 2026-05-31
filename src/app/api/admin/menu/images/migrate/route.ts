import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BATCH = 25

function parseDataImage(dataUrl: string): { mime: string; bytes: Buffer; ext: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(String(dataUrl || '').trim())
  if (!match) return null
  try {
    const mime = match[1]
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
    return { mime, bytes: Buffer.from(match[2], 'base64'), ext }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { ok: false, error: 'BLOB_READ_WRITE_TOKEN не настроен' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({} as any))
    const limit = Math.max(1, Math.min(MAX_BATCH, Number(body?.limit || 10)))
    const dishes = await prisma.dish.findMany({
      where: {
        restaurantId: ctx.restaurantId,
        image: { startsWith: 'data:image/' },
      },
      select: { id: true, image: true, updatedAt: true },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    })

    let migrated = 0
    let skipped = 0
    const errors: string[] = []

    for (const dish of dishes) {
      const parsed = parseDataImage(String(dish.image || ''))
      if (!parsed || parsed.bytes.length === 0) {
        skipped += 1
        continue
      }
      try {
        const blob = await put(`menu/${ctx.restaurantId}/${dish.id}-${new Date(dish.updatedAt).getTime()}.${parsed.ext}`, parsed.bytes, {
          access: 'public',
          contentType: parsed.mime,
        })
        await prisma.dish.update({
          where: { id: dish.id, restaurantId: ctx.restaurantId },
          data: { image: blob.url },
        })
        migrated += 1
      } catch (e: any) {
        errors.push(`${dish.id}: ${String(e?.message || e)}`)
      }
    }

    const remaining = await prisma.dish.count({
      where: { restaurantId: ctx.restaurantId, image: { startsWith: 'data:image/' } },
    })

    return NextResponse.json({
      ok: errors.length === 0,
      migrated,
      skipped,
      remaining,
      errors,
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : (e?.message || 'Ошибка миграции фото') },
      { status }
    )
  }
}
