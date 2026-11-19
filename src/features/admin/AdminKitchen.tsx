'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Badge, Btn, Card, Empty, Segmented } from '@/components/kit'

/*
 * Кухня: что готовить в выбранный день — заказы и рационы вместе.
 * Доставка рациона, для которой уже создан заказ, считается один раз — через заказ.
 */

type Sub = {
  id: string
  status: string
  user: { displayName: string } | null
  items: { quantity: number; dayOfWeek: number | null; dish: { name: string } | null }[]
  deliveries: { id: string; scheduledDate: string; status: string; orderId: string | null }[]
}
type Order = {
  id: string
  status: string
  createdAt: string
  deliveryTime?: string | null
  userName: string
  lines?: { name: string; qty: number }[]
}
type Summary = { total: number; pending: number; failed: number; lastError: string | null }

const LIVE = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY'])
const sameDay = (iso: string | null | undefined, d: Date) => Boolean(iso) && new Date(iso as string).toDateString() === d.toDateString()

export function AdminKitchen() {
  const [subs, setSubs] = useState<Sub[] | null>(null)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [offset, setOffset] = useState<'0' | '1'>('0')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const get = (u: string) => fetch(u, { cache: 'no-store', credentials: 'include' }).then((r) => r.json()).catch(() => null)
    const [a, b, c] = await Promise.all([get('/api/admin/subscriptions'), get('/api/admin/orders?items=1&limit=100'), get('/api/admin/subscriptions/kitchen')])
    setSubs(a?.ok ? a.subscriptions : [])
    setOrders(b?.ok ? b.orders : [])
    if (c?.ok) setSummary(c)
  }, [])
  useEffect(() => {
    void load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const day = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + Number(offset))
    return d
  }, [offset])
  const dow = day.getDay()

  /** заказы на этот день: живые без времени (сегодня) или ко времени этого дня */
  const dayOrders = useMemo(
    () =>
      (orders ?? []).filter((o) => LIVE.has(o.status) && (o.deliveryTime ? sameDay(o.deliveryTime, day) : offset === '0')),
    [orders, day, offset]
  )
  /** доставки рационов на этот день, по которым заказа ещё нет */
  const rationRows = useMemo(() => {
    const out: { sub: Sub; delivery: Sub['deliveries'][number]; items: Sub['items'] }[] = []
    for (const s of subs ?? []) {
      if (s.status !== 'ACTIVE') continue
      const dl = s.deliveries.find((d) => sameDay(d.scheduledDate, day) && d.status !== 'CANCELLED' && d.status !== 'SKIPPED')
      if (!dl) continue
      out.push({ sub: s, delivery: dl, items: s.items.filter((it) => it.dayOfWeek == null || it.dayOfWeek === dow) })
    }
    return out
  }, [subs, day, dow])

  const totals = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of dayOrders) for (const l of o.lines ?? []) m.set(l.name, (m.get(l.name) ?? 0) + l.qty)
    for (const r of rationRows) {
      if (r.delivery.orderId) continue
      for (const it of r.items) {
        const n = it.dish?.name ?? 'блюдо'
        m.set(n, (m.get(n) ?? 0) + it.quantity)
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [dayOrders, rationRows])
  const portions = totals.reduce((n, [, q]) => n + q, 0)

  const collect = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/subscriptions/kitchen', { method: 'POST', credentials: 'include' })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) throw new Error('не получилось')
      toast.success(d.created > 0 ? `создано заказов: ${d.created}` : 'всё уже собрано')
      if (d.failed > 0) toast.error(`не вышло ${d.failed}: ${(d.errors ?? []).join('; ')}`, { duration: 8000 })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ошибка')
    } finally {
      setBusy(false)
    }
  }

  const delivered = async (deliveryId: string) => {
    const res = await fetch(`/api/admin/subscriptions/deliveries/${deliveryId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark_delivered' }),
    })
    const d = await res.json().catch(() => null)
    if (!res.ok || !d?.ok) toast.error(d?.error || 'не получилось')
    else toast.success('отмечено')
    await load()
  }

  if (subs === null || orders === null) return <div className="h-48 animate-pulse rounded-[20px] bg-[color:var(--surface)]" aria-busy />

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={offset}
        onChange={setOffset}
        options={[
          { value: '0', label: 'сегодня' },
          { value: '1', label: `завтра · ${new Date(Date.now() + 864e5).toLocaleDateString('ru-RU', { weekday: 'short' })}` },
        ]}
      />

      {offset === '0' && summary && summary.pending > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[color:var(--warn-bg)] px-3.5 py-3">
          <div className="text-[13.5px] text-[color:var(--warn)]">
            рационы: {summary.pending} из {summary.total} ещё не переданы на кухню заказами
          </div>
          <Btn disabled={busy} onClick={collect}>
            {busy ? '…' : 'передать'}
          </Btn>
        </div>
      ) : null}
      {offset === '0' && summary && summary.failed > 0 ? (
        <div className="rounded-[14px] bg-[color:var(--danger-bg)] px-3 py-2 text-[13px] text-[color:var(--danger)]">не собралось {summary.failed}: {summary.lastError}</div>
      ) : null}

      {!totals.length && !rationRows.length ? (
        <Empty title={offset === '0' ? 'на сегодня готовить нечего' : 'на завтра пока ничего'} hint="заказы и рационы появятся здесь" />
      ) : (
        <>
          <Card className="!py-1.5">
            <div className="flex items-baseline justify-between py-1.5">
              <span className="text-[12.5px] font-semibold text-[color:var(--muted)]">готовить</span>
              <span className="text-[12.5px] text-[color:var(--muted)]">{portions} порц.</span>
            </div>
            {totals.map(([name, n]) => (
              <div key={name} className="flex min-h-[40px] items-center justify-between gap-3 border-t border-[color:var(--stroke)]">
                <span className="min-w-0 truncate text-[14px] text-[color:var(--text)]">{name}</span>
                <span className="text-[15px] font-bold tabular-nums text-[color:var(--text)]">{n}</span>
              </div>
            ))}
          </Card>

          {dayOrders.length ? (
            <section>
              <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">заказы · {dayOrders.length}</h2>
              <Card className="!py-1">
                {dayOrders.map((o, i) => (
                  <Link key={o.id} href={`/admin/orders/${o.id}`} prefetch={false} className={i > 0 ? 'block border-t border-[color:var(--stroke)] py-2' : 'block py-2'}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-[color:var(--text)]">#{o.id.slice(-4)} · {o.userName}</span>
                      {o.deliveryTime ? (
                        <Badge tone="warn">к {new Date(o.deliveryTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Badge>
                      ) : null}
                    </div>
                    <div className="truncate text-[12.5px] text-[color:var(--muted)]">{(o.lines ?? []).map((l) => `${l.qty}× ${l.name}`).join(', ')}</div>
                  </Link>
                ))}
              </Card>
            </section>
          ) : null}

          {rationRows.length ? (
            <section>
              <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">рационы · {rationRows.length}</h2>
              <Card className="!py-1">
                {rationRows.map(({ sub, delivery, items }, i) => (
                  <div key={delivery.id} className={i > 0 ? 'border-t border-[color:var(--stroke)] py-2' : 'py-2'}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-[color:var(--text)]">{sub.user?.displayName ?? 'гость'}</span>
                      {delivery.status === 'DELIVERED' ? (
                        <Badge tone="muted">доставлено</Badge>
                      ) : delivery.orderId ? (
                        <Link href={`/admin/orders/${delivery.orderId}`} prefetch={false}>
                          <Badge tone="ok">заказ #{delivery.orderId.slice(-4)}</Badge>
                        </Link>
                      ) : (
                        <Badge tone="warn">ещё не на кухне</Badge>
                      )}
                    </div>
                    <div className="truncate text-[12.5px] text-[color:var(--muted)]">{items.map((it) => `${it.quantity}× ${it.dish?.name ?? 'блюдо'}`).join(', ') || 'блюд на этот день нет'}</div>
                    {delivery.orderId && delivery.status !== 'DELIVERED' ? (
                      <button type="button" onClick={() => void delivered(delivery.id)} className="mt-1 text-[13px] font-semibold text-[color:var(--text)]">
                        отметить доставленным
                      </button>
                    ) : null}
                  </div>
                ))}
              </Card>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
