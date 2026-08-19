'use client'

import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'

type Stats = {
  periods?: {
    today?: { orders?: number; revenue?: number; averageOrderValue?: number }
    last7d?: { orders?: number; revenue?: number; averageOrderValue?: number; cancelledOrders?: number }
  }
  definitions?: { revenue?: string; averageOrderValue?: string; cancelledOrders?: string }
}

export function AdminKpiPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let disposed = false
    fetch('/api/admin/stats', { cache: 'no-store', credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!disposed && response.ok && data?.ok) setStats(data)
        else if (!disposed) setError(true)
      })
      .catch(() => {
        if (!disposed) setError(true)
      })
    return () => {
      disposed = true
    }
  }, [])

  if (error || !stats?.periods) return null
  const today = stats.periods.today ?? {}
  const last7d = stats.periods.last7d ?? {}
  return (
    <section className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">KPI</p>
          <h2 className="mt-1 text-[17px] font-extrabold text-[color:var(--text)]">экономика заказов</h2>
        </div>
        <span className="text-[11px] font-semibold text-[color:var(--muted)]">сегодня · 7 дней</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-[16px] bg-[color:var(--surface-strong)] px-3 py-3"><div className="text-[17px] font-extrabold tabular-nums">{today.orders ?? 0}</div><div className="text-[10px] font-semibold text-[color:var(--muted)]">заказов сегодня</div></div>
        <div className="rounded-[16px] bg-[color:var(--surface-strong)] px-3 py-3"><div className="text-[17px] font-extrabold tabular-nums">{formatPrice(Number(today.revenue ?? 0))}</div><div className="text-[10px] font-semibold text-[color:var(--muted)]">выручка сегодня</div></div>
        <div className="rounded-[16px] bg-[color:var(--surface-strong)] px-3 py-3"><div className="text-[17px] font-extrabold tabular-nums">{formatPrice(Number(last7d.averageOrderValue ?? 0))}</div><div className="text-[10px] font-semibold text-[color:var(--muted)]">средний чек · 7д</div></div>
        <div className="rounded-[16px] bg-[color:var(--surface-strong)] px-3 py-3"><div className="text-[17px] font-extrabold tabular-nums">{last7d.cancelledOrders ?? 0}</div><div className="text-[10px] font-semibold text-[color:var(--muted)]">отмены · 7д</div></div>
      </div>
      <p className="mt-3 text-[10px] leading-snug text-[color:var(--muted)]">Выручка и средний чек считают только неотменённые заказы; количество заказов включает все созданные заказы периода.</p>
    </section>
  )
}
