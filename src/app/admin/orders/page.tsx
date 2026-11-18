'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Card, Empty, Screen, Segmented, fmtThb } from '@/components/kit'
import { ORDER_STATE } from '@/lib/order-ui'

type Row = {
  id: string
  status: string
  itemsCount: number
  totalAmount: number
  paymentStatus: string
  paymentOptionSlug?: string | null
  receiptUrl?: string | null
  createdAt: string
  deliveryTime?: string | null
  userName: string
  address?: { street?: string; city?: string } | null
}

type Tab = 'active' | 'done'
const LIVE = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'])

function time(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function day(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [tab, setTab] = useState<Tab>('active')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/orders', { cache: 'no-store', credentials: 'include' })
    const d = await res.json().catch(() => null)
    if (res.ok && d?.ok) setRows(d.orders)
  }, [])
  useEffect(() => {
    void load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  const list = useMemo(() => (rows ?? []).filter((r) => (tab === 'active' ? LIVE.has(r.status) : !LIVE.has(r.status))), [rows, tab])
  const liveCount = (rows ?? []).filter((r) => LIVE.has(r.status)).length

  return (
    <Screen title="заказы" subtitle={rows ? `${liveCount} в работе` : undefined}>
      <div className="mb-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'active', label: `в работе${liveCount ? ` · ${liveCount}` : ''}` }, { value: 'done', label: 'закрытые' }]} />
      </div>
      {rows === null ? (
        <div className="flex flex-col gap-2.5" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-[20px] bg-[color:var(--surface)]" />)}</div>
      ) : !list.length ? (
        <Empty title={tab === 'active' ? 'сейчас заказов нет' : 'закрытых заказов пока нет'} hint={tab === 'active' ? 'новые появятся здесь и в Telegram' : undefined} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((r) => {
            const st = ORDER_STATE[r.status] ?? { label: r.status, tone: 'muted' as const }
            const review = r.paymentStatus === 'UNDER_REVIEW'
            const waitingReceipt = r.paymentStatus === 'AWAITING_RECEIPT'
            return (
              <Link key={r.id} href={`/admin/orders/${r.id}`} prefetch={false}>
                <Card>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[15px] font-semibold text-[color:var(--text)]">
                      #{r.id.slice(-4)} <span className="font-normal text-[color:var(--muted)]">· {tab === 'active' ? time(r.createdAt) : day(r.createdAt)}</span>
                    </div>
                    <Badge tone={review ? 'warn' : waitingReceipt ? 'muted' : st.tone}>{review ? 'чек на проверке' : waitingReceipt ? 'ждём чек' : st.label}</Badge>
                  </div>
                  <div className="mt-1 truncate text-[13px] text-[color:var(--muted)]">
                    {r.userName} · {r.itemsCount} поз. · {fmtThb(r.totalAmount)}{r.address?.street ? ` · ${r.address.street}` : ''}
                  </div>
                  {r.deliveryTime && LIVE.has(r.status) ? <div className="mt-1 text-[13px] font-semibold text-[color:var(--warn)]">ко времени: {time(r.deliveryTime)}</div> : null}
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </Screen>
  )
}
