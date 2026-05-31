import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { resolveApiUser } from '@/lib/tg-auth-resolver'
import { isQrSlug } from '@/lib/payment-methods'
import { notifyOwnersManualPaymentReview } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(request: NextRequest, ctx: { params: { orderId: string } }) {
  try {
    const authUser = await resolveApiUser(headers())
    const userId = authUser.userId
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'нужна авторизация' }, { status: 401 })
    }
    const { orderId } = ctx.params
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'orderId required' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        restaurantId: true,
        paymentStatus: true,
        paymentOptionSlug: true,
        totalAmount: true,
        paymentAmountRub: true,
        user: { select: { name: true, telegramFirstName: true } },
      },
    })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'заказ не найден' }, { status: 404 })
    }
    if (order.paymentStatus !== 'AWAITING_RECEIPT') {
      return NextResponse.json({ ok: false, error: 'чек уже загружен или оплата не требуется' }, { status: 400 })
    }
    if (!isQrSlug(order.paymentOptionSlug)) {
      return NextResponse.json({ ok: false, error: 'для этого способа чек не нужен' }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof (file as any).arrayBuffer !== 'function' || typeof (file as any).type !== 'string') {
      return NextResponse.json({ ok: false, error: 'Файл не найден' }, { status: 400 })
    }
    const imageFile = file as File
    if (!ALLOWED_MIME.has(imageFile.type)) {
      return NextResponse.json({ ok: false, error: 'jpg, png, webp, gif' }, { status: 400 })
    }
    if (imageFile.size <= 0 || imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, error: 'до 6MB' }, { status: 400 })
    }

    const ext = EXT_BY_MIME[imageFile.type] || 'jpg'
    const fileName = `slip-${Date.now()}-${randomUUID()}.${ext}`
    const buffer = Buffer.from(await imageFile.arrayBuffer())
    let receiptUrl: string
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`orders/${order.restaurantId}/${orderId}/${fileName}`, buffer, {
        access: 'public',
        contentType: imageFile.type,
      })
      receiptUrl = blob.url
    } else {
      const relativeDir = path.join('uploads', 'orders', order.restaurantId, orderId)
      const absoluteDir = path.join(process.cwd(), 'public', relativeDir)
      await mkdir(absoluteDir, { recursive: true })
      const absolutePath = path.join(absoluteDir, fileName)
      await writeFile(absolutePath, buffer)
      receiptUrl = `/${path.posix.join('uploads', 'orders', order.restaurantId, orderId, fileName)}`
    }

    const envBase =
      String(process.env.APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
    const origin = String(request.nextUrl?.origin || '').replace(/\/+$/, '') || envBase
    const absoluteReceipt =
      receiptUrl.startsWith('http') || receiptUrl.startsWith('//')
        ? receiptUrl
        : origin
          ? `${origin}${receiptUrl.startsWith('/') ? '' : '/'}${receiptUrl}`
          : receiptUrl

    await prisma.order.update({
      where: { id: orderId },
      data: {
        receiptUrl,
        receiptUploadedAt: new Date(),
        paymentStatus: 'UNDER_REVIEW',
      },
    })

    const totalThb = Number(order.totalAmount)
    const rub = order.paymentAmountRub != null ? Number(order.paymentAmountRub) : null
    const userName = String(order.user?.name || order.user?.telegramFirstName || 'Клиент')
    await notifyOwnersManualPaymentReview({
      restaurantId: order.restaurantId,
      orderId,
      receiptUrl: absoluteReceipt,
      totalThb,
      rubAmount: rub,
      userName,
    }).catch((err) => {
      console.error('[orders/receipt] notifyOwnersManualPaymentReview failed', {
        orderId,
        restaurantId: order.restaurantId,
        err: String((err as any)?.message || err || ''),
      })
    })

    return NextResponse.json({ ok: true, receiptUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Ошибка' }, { status: 500 })
  }
}
