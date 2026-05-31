import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseDataImage(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const trimmed = String(dataUrl || '').trim()
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(trimmed)
  if (!match) return null
  try {
    return { mime: match[1], bytes: Buffer.from(match[2], 'base64') }
  } catch {
    return null
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url)
    const requestedRestaurantId = String(url.searchParams.get('r') || '').trim()
    let restaurantId = await getConsumerRestaurantId()
    if (requestedRestaurantId) {
      const exists = await prisma.restaurant.findUnique({
        where: { id: requestedRestaurantId },
        select: { id: true },
      })
      if (exists?.id) restaurantId = requestedRestaurantId
    }
    const id = String(params?.id || '')
    if (!id) return new NextResponse('Not Found', { status: 404 })

    let dish = await prisma.dish.findFirst({
      where: { id, restaurantId, isAvailable: true },
      select: { image: true, updatedAt: true },
    })
    if (!dish?.image) {
      dish = await prisma.dish.findFirst({
        where: { id, isAvailable: true },
        select: { image: true, updatedAt: true },
      })
    }
    if (!dish?.image) return new NextResponse('Not Found', { status: 404 })

    const parsed = parseDataImage(dish.image)
    if (!parsed) {
      return NextResponse.redirect(dish.image, { status: 307 })
    }

    return new NextResponse(new Uint8Array(parsed.bytes), {
      status: 200,
      headers: {
        'content-type': parsed.mime,
        'cache-control': 'public, max-age=604800, immutable',
        etag: `"dish-${id}-${new Date(dish.updatedAt).getTime()}"`,
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}

