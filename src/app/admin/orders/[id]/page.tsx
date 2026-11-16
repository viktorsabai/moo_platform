'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Badge, BottomBar, Btn, Card, Screen, fmtThb } from '@/components/kit'
import { ORDER_NEXT, ORDER_STATE, ORDER_STEPS } from '@/lib/order-ui'
import { cn } from '@/lib/utils'

type Detail = {
  id: string
  status: string
  totalAmount: number
  discountAmount: number
  paymentStatus: string
  paymentOptionSlug?: string | null
  paymentAmountRub?: number | null
  receiptUrl?: string | null
  deliveryTime?: string | null
  createdAt: string
  guestNote?: string | null
  source: 'order' | 'subscription'
  customer: { name: string; username?: string | null; phone?: string | null; ordersCount: number }
  address?: { street?: string; city?: string } | null
  items: Array<{ id: string; name: string; quantity: number; price: number; options: string[] }>
}

const PAY_LABEL: Record<string, string> = { CASH: 'наличные курьеру', QR_THB: 'QR · баты', QR_RUB: 'QR · рубли', STRIPE: 'карта', SUBSCRIPTION: 'рацион (оплачен)' }

export default function AdminOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [o, setO] = useState<Detail | null>(null)
  const [busy, setBusy] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/orders?id=${encodeURIComponent(id)}`, { cache: 'no-store', credentials: 'include' })
    const d = await res.json().catch(() => null)
    if (res.ok && d?.ok) setO(d.order)
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  const patch = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/orders', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: id, ...body }) })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) throw new Error(d?.error || 'не получилось')
      toast.success(okMsg)
      if (typeof d.notifyHint === 'string' && d.notifyHint.trim()) toast(d.notifyHint, { duration: 6000 })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ошибка')
    } finally {
      setBusy(false)
    }
  }

  if (!o) {
    return (
      <Screen title="заказ" back="/admin/orders">
        <div className="h-40 animate-pulse rounded-[20px] bg-[color:var(--surface)]" aria-busy />
      </Screen>
    )
  }

  const st = ORDER_STATE[o.status] ?? { label: o.status, tone: 'muted' as const }
  const next = ORDER_NEXT[o.status] ?? null
  const stepIdx = ORDER_STEPS.findIndex((s) => s.status === o.status)
  const review = o.paymentStatus === 'UNDER_REVIEW'
  const awaiting = o.paymentStatus === 'AWAITING_RECEIPT'
  const paid = o.paymentStatus === 'PAID'
  const subtotal = o.items.reduce((n, it) => n + it.price * it.quantity, 0)
  const deliveryFee = Math.max(0, o.totalAmount - subtotal + o.discountAmount)
  const canCancel = !['DELIVERED', 'CANCELLED'].includes(o.status)
  const tgHref = o.customer.username ? `https://t.me/${o.customer.username.replace(/^@/, '')}` : null
  const mapsHref = o.address?.street ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([o.address.street, o.address.city].filter(Boolean).join(', '))}` : null

  return (
    <Screen
      title={`заказ #${o.id.slice(-4)}`}
      subtitle={`${new Date(o.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${o.source === 'subscription' ? ' · из рациона' : ''}`}
      back="/admin/orders"
      right={<Badge tone={st.tone}>{st.label}</Badge>}
    >
      <div className="flex flex-col gap-2.5">
        {o.status !== 'CANCELLED' ? (
          <div className="flex items-start px-1 pt-1" aria-label="этапы заказа">
            {ORDER_STEPS.map((s, i) => {
              const done = stepIdx >= i
              return (
                <div key={s.status} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className={cn('h-3.5 w-3.5 rounded-full', done ? 'bg-[color:var(--text)]' : 'bg-[color:var(--stroke-strong)]')} />
                  <div className={cn('text-[11px]', done ? 'font-semibold text-[color:var(--text)]' : 'text-[color:var(--muted)]')}>{s.label}</div>
                </div>
              )
            })}
          </div>
        ) : null}

        {o.deliveryTime ? (
          <div className="rounded-[14px] bg-[color:var(--warn-bg)] px-3 py-2 text-[13px] font-semibold text-[color:var(--warn)]">
            ко времени: {new Date(o.deliveryTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        ) : null}

        {/* оплата */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12.5px] font-semibold text-[color:var(--muted)]">оплата · {PAY_LABEL[o.paymentOptionSlug ?? ''] ?? o.paymentOptionSlug ?? '—'}</div>
            <Badge tone={paid ? 'ok' : review ? 'warn' : awaiting ? 'muted' : o.paymentStatus === 'FAILED' ? 'danger' : 'muted'}>
              {paid ? 'оплачен' : review ? 'ждёт проверки' : awaiting ? 'ждём чек' : o.paymentStatus === 'FAILED' ? 'чек отклонён' : 'при получении'}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-[22px] font-bold tracking-tight text-[color:var(--text)]">{fmtThb(o.totalAmount)}</div>
            {o.paymentAmountRub ? <div className="text-[13px] text-[color:var(--muted)]">≈ {Math.round(o.paymentAmountRub).toLocaleString('ru-RU')} ₽</div> : null}
          </div>
          {o.receiptUrl ? (
            <div className="mt-3">
              <button type="button" onClick={() => setReceiptOpen((v) => !v)} className="text-[14px] font-semibold text-[color:var(--text)] underline underline-offset-4">
                {receiptOpen ? 'скрыть чек' : 'посмотреть чек'}
              </button>
              {receiptOpen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.receiptUrl} alt="чек об оплате" className="mt-2 max-h-[420px] w-full rounded-[12px] object-contain" />
              ) : null}
            </div>
          ) : null}
          {review ? (
            <div className="mt-3 flex gap-2">
              <Btn variant="secondary" disabled={busy} onClick={() => patch({ paymentDecision: 'reject' }, 'чек отклонён, гостю написали')}>чек не подходит</Btn>
              <Btn full disabled={busy} onClick={() => patch({ paymentDecision: 'approve' }, 'оплата подтверждена')}>подтвердить оплату</Btn>
            </div>
          ) : null}
        </Card>

        {/* состав */}
        <Card>
          {o.items.map((it, i) => (
            <div key={it.id} className={cn('flex justify-between gap-3 text-[14px]', i && 'mt-2')}>
              <div className="min-w-0">
                <div className="text-[color:var(--text)]">{it.quantity} × {it.name}</div>
                {it.options.length ? <div className="text-[12.5px] text-[color:var(--muted)]">{it.options.join(', ')}</div> : null}
              </div>
              <div className="shrink-0 text-[color:var(--text)]">{fmtThb(it.price * it.quantity)}</div>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-[color:var(--stroke)] pt-2 text-[14px] text-[color:var(--muted)]">
            <span>доставка</span><span>{deliveryFee > 0 ? fmtThb(deliveryFee) : 'бесплатно'}</span>
          </div>
          {o.discountAmount > 0 ? <div className="mt-1 flex justify-between text-[14px] text-[color:var(--muted)]"><span>скидка</span><span>−{fmtThb(o.discountAmount)}</span></div> : null}
          {o.guestNote ? <div className="mt-3 rounded-[12px] bg-[color:var(--surface)] px-3 py-2 text-[13px] text-[color:var(--text)]">{o.guestNote}</div> : null}
        </Card>

        {/* адрес и гость */}
        <Card>
          <div className="text-[14px] font-semibold text-[color:var(--text)]">{o.address?.street || 'адрес не указан'}</div>
          {o.address?.city ? <div className="text-[13px] text-[color:var(--muted)]">{o.address.city}</div> : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-[color:var(--text)]">{o.customer.name}</div>
              <div className="text-[12.5px] text-[color:var(--muted)]">{o.customer.ordersCount}-й заказ{o.customer.username ? ` · @${o.customer.username.replace(/^@/, '')}` : ''}</div>
            </div>
            <div className="flex gap-2">
              {o.customer.phone ? <a href={`tel:${o.customer.phone}`} className={linkBtn}>позвонить</a> : null}
              {tgHref ? <a href={tgHref} target="_blank" rel="noreferrer" className={linkBtn}>написать</a> : null}
              {mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer" className={linkBtn}>маршрут</a> : null}
            </div>
          </div>
        </Card>

        {canCancel ? (
          <Btn variant="danger" disabled={busy} onClick={() => { if (window.confirm('Отменить заказ? Гость получит уведомление.')) void patch({ status: 'CANCELLED' }, 'заказ отменён') }}>
            отменить заказ
          </Btn>
        ) : null}
      </div>

      {next ? (
        <BottomBar>
          <Btn size="lg" full disabled={busy} onClick={() => patch({ status: next.to }, 'готово')}>
            {next.label}
          </Btn>
        </BottomBar>
      ) : null}
    </Screen>
  )
}

const linkBtn = 'inline-flex h-11 items-center rounded-[14px] border border-[color:var(--stroke)] px-3.5 text-[13px] font-semibold text-[color:var(--text)]'
