'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDateTime, formatPrice } from '@/lib/utils'
import { OwnerWorkspaceHeader } from '@/components/admin/OwnerWorkspaceHeader'
import { getOrderNextAction } from '@/lib/order-status'

type OrderRow = {
  id: string
  status: string
  itemsCount: number
  totalAmount: number
  paymentStatus?: string
  fulfillmentMethod?: string | null
  createdAt: string
  userName: string
  address?: { street?: string; city?: string }
}

const TERMINAL = new Set(['DELIVERED', 'CANCELLED'])
const statusLabels: Record<string, string> = { PENDING: 'новый', CONFIRMED: 'подтверждён', PREPARING: 'готовится', READY: 'готов', OUT_FOR_DELIVERY: 'в пути', DELIVERED: 'доставлен', CANCELLED: 'отменён' }

export default function OperationsWorkspacePage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'не удалось загрузить очередь')
      setOrders(Array.isArray(data.orders) ? data.orders : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'не удалось загрузить очередь')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const activeOrders = useMemo(() => orders.filter((order) => !TERMINAL.has(String(order.status).toUpperCase())), [orders])
  const paymentReview = useMemo(() => orders.filter((order) => String(order.paymentStatus || '').toUpperCase() === 'UNDER_REVIEW'), [orders])
  const queue = useMemo(() => [...activeOrders].sort((a, b) => {
    const priority = (order: OrderRow) => String(order.paymentStatus || '').toUpperCase() === 'UNDER_REVIEW' ? 0 : String(order.status).toUpperCase() === 'PENDING' ? 1 : 2
    return priority(a) - priority(b) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  }), [activeOrders])

  async function advance(order: OrderRow) {
    const next = getOrderNextAction(String(order.status).toUpperCase())
    if (!next) return
    setUpdating(order.id)
    try {
      const res = await fetch('/api/admin/orders', { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: order.id, status: next.toStatus }) })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'не удалось обновить статус')
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: next.toStatus } : item))
      toast.success('следующий шаг выполнен')
      if (data.notifyHint) toast(data.notifyHint, { icon: '⚠️', duration: 6000 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'не удалось обновить статус')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <main className="ui-container ui-screen min-w-0 max-w-full overflow-x-hidden !pb-20">
      <OwnerWorkspaceHeader title="операции" subtitle="Одна очередь для заказов и исключений. Сначала обработайте то, что блокирует гостя или кухню." primaryHref="/admin/orders" primaryLabel="полный список" />

      <section className="grid grid-cols-3 gap-2">
        {[['нужно сделать', queue.length], ['проверка оплаты', paymentReview.length], ['активные', activeOrders.length]].map(([label, value]) => <div key={String(label)} className="rounded-[20px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3"><div className="text-[20px] font-black tabular-nums text-[color:var(--text)]">{value}</div><div className="mt-1 text-[10px] font-extrabold text-[color:var(--muted)]">{label}</div></div>)}
      </section>

      {error ? <div className="mt-4 rounded-[22px] border border-rose-200 bg-rose-50 p-4 text-[13px] font-semibold text-rose-900"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-full bg-rose-900 px-3 py-2 text-[11px] font-extrabold text-white">повторить</button></div> : null}
      {loading ? <div className="mt-4 rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-5 text-[13px] font-semibold text-[color:var(--muted)]">загружаем операционную очередь…</div> : null}
      {!loading && !error && queue.length === 0 ? <div className="mt-4 rounded-[26px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-6"><p className="text-[18px] font-black text-[color:var(--text)]">всё чисто</p><p className="mt-1 max-w-[420px] text-[13px] font-medium leading-relaxed text-[color:var(--muted)]">Новых заказов и блокирующих операций нет. Можно проверить витрину или посмотреть экономику.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/admin/storefront" prefetch={false} className="rounded-full bg-[color:var(--primary)] px-4 py-2.5 text-[12px] font-extrabold text-white">проверить витрину</Link><Link href="/admin/visits" prefetch={false} className="rounded-full border border-[color:var(--stroke)] px-4 py-2.5 text-[12px] font-extrabold text-[color:var(--text)]">открыть аналитику</Link></div></div> : null}

      {!loading && !error && queue.length > 0 ? <section className="mt-4 space-y-3">{queue.map((order) => {
        const status = String(order.status || '').toUpperCase()
        const next = getOrderNextAction(status)
        const needsPayment = String(order.paymentStatus || '').toUpperCase() === 'UNDER_REVIEW'
        return <article key={order.id} className={`rounded-[26px] border p-4 ${needsPayment ? 'border-amber-200 bg-amber-50/70' : 'border-[color:var(--stroke)] bg-[color:var(--surface)]'}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--muted)]">{needsPayment ? 'требует проверки оплаты' : 'операционная очередь'}</p><h2 className="mt-1 text-[17px] font-black text-[color:var(--text)]">#{order.id.slice(-8)} · {order.userName || 'гость'}</h2><p className="mt-1 text-[12px] font-medium text-[color:var(--muted)]">{order.itemsCount} поз. · {String(order.fulfillmentMethod).toUpperCase() === 'PICKUP' ? 'самовывоз' : 'доставка'} · {formatDateTime(order.createdAt)}</p>{order.address?.street ? <p className="mt-1 truncate text-[12px] font-medium text-[color:var(--muted)]">{order.address.street}</p> : null}</div><div className="shrink-0 text-right"><p className="text-[16px] font-black tabular-nums text-[color:var(--text)]">{formatPrice(Number(order.totalAmount || 0))}</p><p className="mt-1 text-[11px] font-extrabold text-[color:var(--muted)]">{statusLabels[status] || status.toLowerCase()}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">{next ? <button type="button" disabled={updating === order.id} onClick={() => void advance(order)} className="rounded-full bg-[color:var(--primary)] px-4 py-2.5 text-[11px] font-extrabold text-white disabled:opacity-50">{updating === order.id ? 'обновляем…' : next.label || 'следующий шаг'}</button> : null}<Link href={`/admin/orders#order-${order.id}`} prefetch={false} className="rounded-full border border-[color:var(--stroke)] px-4 py-2.5 text-[11px] font-extrabold text-[color:var(--text)]">открыть детали</Link></div>
        </article>
      })}</section> : null}
    </main>
  )
}
