import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { put } from '@vercel/blob'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(request: Request) {
  let imageFile: File | null = null
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const form = await request.formData()
    const file = form.get('file')
    if (!file || typeof (file as any).arrayBuffer !== 'function' || typeof (file as any).type !== 'string') {
      return NextResponse.json({ ok: false, error: 'Файл не найден' }, { status: 400 })
    }
    imageFile = file as File
    if (!ALLOWED_MIME.has(imageFile.type)) {
      return NextResponse.json({ ok: false, error: 'Поддерживаются: jpg, png, webp, gif' }, { status: 400 })
    }
    if (imageFile.size <= 0 || imageFile.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, error: 'Размер файла до 8MB' }, { status: 400 })
    }

    const ext = EXT_BY_MIME[imageFile.type] || 'jpg'
    const fileName = `${Date.now()}-${randomUUID()}.${ext}`
    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const hasBlobToken = Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || '').trim())
    const runningOnVercel = Boolean(String(process.env.VERCEL || '').trim())
    if (hasBlobToken) {
      const blob = await put(`payment-qr/${ctx.restaurantId}/${fileName}`, buffer, {
        access: 'public',
        contentType: imageFile.type,
      })
      return NextResponse.json({ ok: true, url: blob.url, storage: 'blob' })
    }
    if (runningOnVercel) {
      return NextResponse.json(
        { ok: false, error: 'Для загрузки QR в production добавьте BLOB_READ_WRITE_TOKEN' },
        { status: 503 }
      )
    }

    const relativeDir = path.join('uploads', 'payment-qr', ctx.restaurantId)
    const absoluteDir = path.join(process.cwd(), 'public', relativeDir)
    await mkdir(absoluteDir, { recursive: true })
    const absolutePath = path.join(absoluteDir, fileName)
    await writeFile(absolutePath, buffer)

    return NextResponse.json({
      ok: true,
      url: `/${path.posix.join('uploads', 'payment-qr', ctx.restaurantId, fileName)}`,
    })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    const code = String(e?.code || '').toUpperCase()
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM' || code === 'ENOENT') {
      return NextResponse.json(
        { ok: false, error: 'Для загрузки QR в production добавьте BLOB_READ_WRITE_TOKEN' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { ok: false, error: status === 403 ? 'forbidden' : (e?.message || 'Ошибка загрузки') },
      { status }
    )
  }
}
