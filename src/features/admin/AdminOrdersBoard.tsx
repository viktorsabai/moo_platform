'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Card, Empty, Segmented, fmtThb } from '@/components/kit'
import { ORDER_STATE } from '@/lib/order-ui'
import { cn } from '@/lib/utils'

/* Живой список заказов главной кабинета: в работе / закрытые, обновление каждые 15 секунд. */

type Row = {
  id: string
  status: string
  itemsCount: number
  totalAmount: number
  paymentStatus: string
  createdAt: string
  deliveryTime?: string | null
  userName: string
  address?: { street?: string; city?: string } | null
}

const LIVE = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'])
const time = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

export function AdminOrdersBoard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [tab, setTab] = useState<'active' | 'done'>('active')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/orders', { cache: 'no-store', credentials: 'include' })
    const d = await res.json().catch(() => null)
    if (res.ok && d?.ok) setRows(d.orders)
    else setRows((prev) => prev ?? [])
  }, [])
  useEffect(() => {
    void load()
    const t = setInterval(load, 15_000)
    const onVis = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  const live = useMemo(() => (rows ?? []).filter((r) => LIVE.has(r.status)), [rows])
  // новые (ждут подтверждения) — наверх
  const list = useMemo(() => {
    if (tab === 'done') return (rows ?? []).filter((r) => !LIVE.has(r.status))
    return [...live].sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING'))
  }, [rows, live, tab])

  return (
    <section>
      <div className="mb-2.5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: `в работе${live.length ? ` · ${live.length}` : ''}` },
            { value: 'done', label: 'закрытые' },
          ]}
        />
      </div>
      {rows === null ? (
        <div className="flex flex-col gap-2.5" aria-busy>
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[20px] bg-[color:var(--surface)]" />
          ))}
        </div>
      ) : !list.length ? (
        <Empty title={tab === 'active' ? 'сейчас заказов нет' : 'закрытых заказов пока нет'} hint={tab === 'active' ? 'новые появятся здесь и в Telegram' : undefined} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((r) => {
            const st = ORDER_STATE[r.status] ?? { label: r.status, tone: 'muted' as const }
            const review = r.paymentStatus === 'UNDER_REVIEW'
            const fresh = r.status === 'PENDING'
            return (
              <Link key={r.id} href={`/admin/orders/${r.id}`} prefetch={false} className="block transition active:scale-[0.99]">
                <Card className={cn(fresh && '!border-[color:var(--warn)] ring-1 ring-[color:var(--warn)]')}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-[15px] font-semibold text-[color:var(--text)]">
                      #{r.id.slice(-4)} · {r.userName}
                    </div>
                    <Badge tone={review ? 'warn' : st.tone}>{review ? 'чек на проверке' : st.label}</Badge>
                  </div>
                  <div className="mt-1 truncate text-[13px] text-[color:var(--muted)]">
                    {tab === 'active' ? time(r.createdAt) : day(r.createdAt)} · {r.itemsCount} поз. · {fmtThb(r.totalAmount)}
                    {r.address?.street ? ` · ${r.address.street}` : ''}
                  </div>
                  {r.deliveryTime && LIVE.has(r.status) ? (
                    <div className="mt-1 text-[13px] font-semibold text-[color:var(--warn)]">ко времени: {time(r.deliveryTime)}</div>
                  ) : null}
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
