'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Screen, Card, Btn } from '@/components/kit'
import { formatPrice } from '@/lib/utils'
import { useVenue } from '@/lib/venue-context'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

type OrderRow = {
  id: string
  paymentStatus: string
  paymentOptionSlug: string | null
  totalAmount: number
  paymentAmountRub: number | null
  receiptUrl: string | null
  restaurant?: { name?: string | null }
}

type PayOption = {
  slug: string
  title: string
  instruction?: string | null
  qrImageUrl?: string | null
  rubPerThb?: number | null
}

export default function OrderPayPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = String(params?.orderId || '')
  const { restaurantId: venueRestaurantId } = useVenue()
  const headers = useMemo(() => {
    const rid = String(venueRestaurantId || '').trim()
    return rid && rid !== 'default' ? { ...telegramInitHeaderRecord(), 'x-ufo-restaurant': rid } : telegramInitHeaderRecord()
  }, [venueRestaurantId])

  const [order, setOrder] = useState<OrderRow | null>(null)
  const [payOption, setPayOption] = useState<PayOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    try {
      const [oRes, sRes] = await Promise.all([
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store', credentials: 'include', headers }),
        fetch('/api/settings', { cache: 'no-store', credentials: 'include', headers }),
      ])
      const oData = await oRes.json().catch(() => null)
      const sData = await sRes.json().catch(() => null)
      if (!oRes.ok || !oData?.ok || !oData.order) {
        toast.error(oData?.error || 'Заказ не найден')
        setOrder(null)
        return
      }
      setOrder(oData.order as OrderRow)
      const slug = String(oData.order.paymentOptionSlug || '').toUpperCase()
      const opts = Array.isArray(sData?.settings?.paymentOptions) ? sData.settings.paymentOptions : []
      const opt = opts.find((p: PayOption) => String(p.slug).toUpperCase() === slug) || null
      setPayOption(opt)
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [orderId, headers])

  useEffect(() => {
    void load()
  }, [load])

  const rubLine =
    order?.paymentAmountRub != null && Number.isFinite(order.paymentAmountRub)
      ? `≈ ${order.paymentAmountRub.toFixed(0)} ₽`
      : null

  async function onPickFile(file: File | null) {
    if (!file || !orderId) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/receipt`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...headers },
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось отправить чек')
        return
      }
      toast.success('Чек отправлен — ждём подтверждения')
      await load()
    } catch {
      toast.error('Ошибка отправки')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <Screen back="/orders" title="оплата">
        <div className="mt-4 text-[14px] text-[color:var(--muted)]">загрузка…</div>
      </Screen>
    )
  }

  if (!order) {
    return (
      <Screen back="/orders" title="оплата">
        <Link href="/orders">
          <Btn full className="mt-4">к заказам</Btn>
        </Link>
      </Screen>
    )
  }

  const st = String(order.paymentStatus || '').toUpperCase()
  if (st !== 'AWAITING_RECEIPT') {
    const uploadedReceipt = String(order.receiptUrl || '').trim()
    return (
      <Screen back="/orders" title="оплата">
        <Card className="mt-4">
          <p className="text-[14px] leading-snug text-[color:var(--text)]">
            {st === 'UNDER_REVIEW'
              ? 'Чек уже на проверке у заведения.'
              : st === 'PAID'
                ? 'Оплата подтверждена.'
                : 'Для этого заказа не требуется загрузка чека.'}
          </p>
          {uploadedReceipt ? (
            <a
              href={uploadedReceipt}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-[13px] font-semibold text-[color:var(--primary)] underline underline-offset-2"
            >
              открыть загруженный чек
            </a>
          ) : null}
          <Btn full className="mt-4" onClick={() => router.push('/orders')}>
            к заказам
          </Btn>
        </Card>
      </Screen>
    )
  }

  const qr = payOption?.qrImageUrl?.trim()

  return (
    <Screen back="/orders" title="оплата" subtitle={order.restaurant?.name || 'заказ'}>
      <div className="mt-2 border-t border-[color:var(--stroke)] pt-4">
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">сумма</div>
        <div className="mt-1 text-[22px] font-extrabold tracking-tight text-[color:var(--text)]">{formatPrice(order.totalAmount)}</div>
        {rubLine ? <div className="mt-1 text-[15px] font-semibold text-[color:var(--text)]">{rubLine}</div> : null}
        {payOption?.instruction ? (
          <p className="mt-3 text-[13px] leading-snug text-[color:var(--muted)]">{payOption.instruction}</p>
        ) : null}
        {qr ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-soft)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="" className="mx-auto max-h-[min(52vh,420px)] w-full max-w-sm object-contain" />
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-[color:var(--muted)]">QR не настроен в кабинете заведения.</p>
        )}
        <label className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[color:var(--primary)] px-4 text-[15px] font-semibold text-[color:var(--on-primary)] transition active:opacity-80 disabled:opacity-50">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              void onPickFile(f || null)
            }}
          />
          {uploading ? 'отправка…' : 'прикрепить чек (скрин перевода)'}
        </label>
        <p className="mt-2 text-[11px] leading-snug text-[color:var(--muted)]">После загрузки команда проверит платёж в Telegram.</p>
      </div>
    </Screen>
  )
}
