'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatDateTime, formatPrice } from '@/lib/utils'
import { ORDER_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { AdminSlaDashboard } from '@/app/admin/AdminSlaDashboard'
import { canCancelOrderStatus, getOrderNextAction } from '@/lib/order-status'

type OrderRow = {
  id: string
  status: string
  itemsCount: number
  totalAmount: number
  paymentStatus?: string
  paymentMethod?: string | null
  paymentOptionSlug?: string | null
  paymentAmountRub?: number | null
  receiptUrl?: string | null
  receiptUploadedAt?: string | null
  createdAt: string
  lastStatusChangeAt?: string
  userName: string
  address?: { street?: string; city?: string }
}

const TERMINAL = new Set(['DELIVERED', 'CANCELLED'])

const HISTORY_SECTION_ORDER = ['Сегодня', 'Вчера', 'Последние 7 дней', 'Ранее'] as const

function daysSinceLocalMidnight(createdAtIso: string): number {
  const now = new Date()
  const created = new Date(createdAtIso)
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t1 = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime()
  return Math.round((t0 - t1) / 86400000)
}

function historySectionTitle(createdAtIso: string): (typeof HISTORY_SECTION_ORDER)[number] {
  const d = daysSinceLocalMidnight(createdAtIso)
  if (d === 0) return 'Сегодня'
  if (d === 1) return 'Вчера'
  if (d <= 7) return 'Последние 7 дней'
  return 'Ранее'
}

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const { activeOrders, historySections } = useMemo(() => {
    const active: OrderRow[] = []
    const history: OrderRow[] = []
    for (const o of orders) {
      const s = String(o.status ?? '').toUpperCase()
      if (TERMINAL.has(s)) history.push(o)
      else active.push(o)
    }
    const byTitle = new Map<string, OrderRow[]>()
    for (const o of history) {
      const title = historySectionTitle(o.createdAt)
      if (!byTitle.has(title)) byTitle.set(title, [])
      byTitle.get(title)!.push(o)
    }
    const sections = HISTORY_SECTION_ORDER.filter((t) => byTitle.has(t)).map((title) => ({
      title,
      orders: byTitle.get(title)!,
    }))
    return { activeOrders: active, historySections: sections }
  }, [orders])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось загрузить')
        setOrders([])
        return
      }
      setOrders(Array.isArray(data.orders) ? data.orders : [])
    } catch {
      setError('ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)))
        toast.success('Статус обновлён')
        if (typeof data.notifyHint === 'string' && data.notifyHint.trim()) {
          toast(data.notifyHint, { icon: '⚠️', duration: 6500 })
        }
      } else {
        toast.error(data?.error || 'Ошибка')
      }
    } catch {
      toast.error('Ошибка')
    } finally {
      setUpdatingId(null)
    }
  }

  async function reviewPayment(orderId: string, decision: 'approve' | 'reject') {
    setUpdatingId(orderId)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, paymentDecision: decision }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        await load()
        toast.success(decision === 'approve' ? 'Оплата подтверждена' : 'Оплата отклонена')
        if (typeof data.notifyHint === 'string' && data.notifyHint.trim()) {
          toast(data.notifyHint, { icon: '⚠️', duration: 6500 })
        }
      } else {
        toast.error(data?.error || 'Ошибка проверки оплаты')
      }
    } catch {
      toast.error('Ошибка проверки оплаты')
    } finally {
      setUpdatingId(null)
    }
  }

  const cardClass = 'ui-surface-card'
  const cardRadius = { borderRadius: 'var(--radius-large)' } as const

  function statusDot(s: string) {
    return s === 'DELIVERED'
      ? 'bg-emerald-500'
      : s === 'CANCELLED'
        ? 'bg-rose-500'
        : s === 'OUT_FOR_DELIVERY' || s === 'READY' || s === 'PREPARING'
          ? 'bg-[color:var(--accent)]'
          : 'bg-black/25'
  }

  function renderActiveCard(o: OrderRow) {
    const s = String(o.status ?? '').toUpperCase()
    const statusLabel = (ORDER_STATUSES as Record<string, string>)[s] ?? s.toLowerCase()
    const paymentStatus = String(o.paymentStatus || 'PENDING').toUpperCase()
    const paymentStatusLabel = (PAYMENT_STATUSES as Record<string, string>)[paymentStatus] ?? paymentStatus
    const next = getOrderNextAction(s)
    const hasReceipt = Boolean(String(o.receiptUrl || '').trim())
    return (
      <div key={o.id} className={cardClass} style={cardRadius}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="ui-h2 text-[14px]">#{String(o.id).slice(-8)}</div>
            <div className="ui-muted mt-0.5 text-[12px]">
              {o.userName} · {o.itemsCount} поз. · {formatDateTime(o.createdAt)}
            </div>
            <div className="ui-muted mt-0.5 text-[11px]">
              оплата: {paymentStatusLabel} {o.paymentOptionSlug ? `· ${String(o.paymentOptionSlug).toUpperCase()}` : o.paymentMethod ? `· ${String(o.paymentMethod).toUpperCase()}` : ''}
              {o.paymentAmountRub != null && Number.isFinite(o.paymentAmountRub) ? ` · ${o.paymentAmountRub.toFixed(0)} ₽` : ''}
            </div>
            {hasReceipt ? (
              <div className="mt-1">
                <a
                  href={String(o.receiptUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-[color:var(--primary)] underline underline-offset-2"
                >
                  открыть чек
                </a>
              </div>
            ) : null}
            {o.lastStatusChangeAt && (
              <div className="ui-muted mt-0.5 text-[11px]">
                последнее изменение: {formatDateTime(o.lastStatusChangeAt)}
              </div>
            )}
            {o.address?.street && <div className="ui-muted mt-0.5 text-[12px]">{o.address.street}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div className="ui-body text-[15px] font-semibold tabular-nums">{formatPrice(o.totalAmount)}</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px]">
              <span className={cn('h-1.5 w-1.5 rounded-full', statusDot(s))} aria-hidden />
              <span className="ui-muted">{statusLabel}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {next ? (
            <button
              type="button"
              onClick={() => updateStatus(o.id, next.toStatus)}
              disabled={updatingId === o.id}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-[12px] font-semibold text-white transition active:opacity-90 disabled:opacity-50"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {updatingId === o.id ? '…' : next.label}
            </button>
          ) : null}
          {canCancelOrderStatus(s) ? (
            <button
              type="button"
              onClick={() => updateStatus(o.id, 'CANCELLED')}
              disabled={updatingId === o.id}
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-700 transition active:opacity-90 disabled:opacity-50"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              Отменить
            </button>
          ) : null}
          {paymentStatus === 'UNDER_REVIEW' ? (
            <>
              <button
                type="button"
                onClick={() => reviewPayment(o.id, 'approve')}
                disabled={updatingId === o.id}
                className="rounded-full bg-emerald-600 px-4 py-2 text-[12px] font-semibold text-white transition active:opacity-90 disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                {updatingId === o.id ? '…' : 'Подтвердить оплату'}
              </button>
              <button
                type="button"
                onClick={() => reviewPayment(o.id, 'reject')}
                disabled={updatingId === o.id}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-700 transition active:opacity-90 disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                {updatingId === o.id ? '…' : 'Отклонить оплату'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  function renderHistoryOrder(o: OrderRow) {
    const s = String(o.status ?? '').toUpperCase()
    const statusLabel = (ORDER_STATUSES as Record<string, string>)[s] ?? s.toLowerCase()
    const paymentStatus = String(o.paymentStatus || 'PENDING').toUpperCase()
    const paymentStatusLabel = (PAYMENT_STATUSES as Record<string, string>)[paymentStatus] ?? paymentStatus
    return (
      <details key={o.id} className="border-t border-[color:var(--stroke)] first:border-t-0">
        <summary className="cursor-pointer list-none py-2.5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-extrabold text-[color:var(--text)]">#{String(o.id).slice(-8)}</div>
              <div className="ui-muted mt-0.5 text-[11px]">{formatDateTime(o.createdAt)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[13px] font-semibold tabular-nums text-[color:var(--text)]">{formatPrice(o.totalAmount)}</div>
              <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[color:var(--muted)]">
                <span className={cn('h-1.5 w-1.5 rounded-full', statusDot(s))} aria-hidden />
                {statusLabel}
              </div>
            </div>
          </div>
        </summary>
        <div className="space-y-1 border-t border-[color:var(--stroke)] pb-3 pt-2 text-[12px] text-[color:var(--muted)]">
          <div>
            {o.userName} · {o.itemsCount} поз.
          </div>
          <div>
            оплата: {paymentStatusLabel}
            {o.paymentMethod ? ` · ${String(o.paymentMethod).toUpperCase()}` : ''}
          </div>
          {o.lastStatusChangeAt ? <div>изменение: {formatDateTime(o.lastStatusChangeAt)}</div> : null}
          {o.address?.street ? <div>{o.address.street}</div> : null}
        </div>
      </details>
    )
  }

  return (
    <main className="ui-container ui-screen">
      <div className="mb-4">
        <h1 className="ui-h1 text-[20px]">Заказы</h1>
        <p className="ui-muted mt-1 text-[13px]">активные сверху · история по периодам</p>
      </div>

      <div className="mb-4">
        <AdminSlaDashboard />
      </div>

      {loading ? (
        <div className={cardClass} style={cardRadius}>
          <div className="ui-muted text-[13px]">загрузка…</div>
        </div>
      ) : error ? (
        <div className={cardClass} style={cardRadius}>
          <div className="text-[13px] font-semibold text-red-600">{error}</div>
        </div>
      ) : orders.length === 0 ? (
        <div className={cardClass} style={cardRadius}>
          <p className="ui-body text-[13px]">Заказов пока нет. После первых заказов они появятся здесь.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              в работе · {activeOrders.length}
            </h2>
            {activeOrders.length === 0 ? (
              <div className={cn(cardClass, 'px-3 py-3 text-[13px] text-[color:var(--muted)]')} style={cardRadius}>
                Нет активных заказов
              </div>
            ) : (
              <div className="space-y-3">{activeOrders.map(renderActiveCard)}</div>
            )}
          </section>

          {historySections.length > 0 ? (
            <details className={cn(cardClass, 'overflow-hidden')} style={cardRadius} open={false}>
              <summary className="cursor-pointer list-none px-3 py-3 text-[14px] font-extrabold text-[color:var(--text)] [&::-webkit-details-marker]:hidden">
                <span className="inline-flex w-full items-center justify-between gap-2">
                  <span>история</span>
                  <span className="text-[12px] font-semibold text-[color:var(--muted)]">
                    {historySections.reduce((n, s) => n + s.orders.length, 0)} заказов
                  </span>
                </span>
              </summary>
              <div className="border-t border-[color:var(--stroke)] px-2 pb-2">
                {historySections.map((sec) => (
                  <div key={sec.title} className="mt-3 first:mt-2">
                    <div className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                      {sec.title}
                    </div>
                    <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2">
                      {sec.orders.map(renderHistoryOrder)}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </main>
  )
}
