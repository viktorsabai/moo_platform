'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SlaResponse = {
  ok: boolean
  overdueTotal: number
  activeOrders: number
  byStatus: Record<string, { total: number; overdue: number }>
  topOverdue: Array<{ id: string; status: string; overdueMinutes: number }>
}

export function AdminSlaDashboard() {
  const [data, setData] = useState<SlaResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/orders/sla', { cache: 'no-store', credentials: 'include' })
        const json = await res.json().catch(() => null)
        if (!cancelled && res.ok && json?.ok) setData(json)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <div className="ui-surface p-4 text-[12px] text-black/55">SLA: загрузка...</div>
  }

  return (
    <div className="ui-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold text-black/80">SLA заказов</div>
          <div className="text-[12px] text-black/55">
            активных: {data?.activeOrders ?? 0} · просрочено: {data?.overdueTotal ?? 0}
          </div>
        </div>
        <Link href="/admin/orders" prefetch={false} className="btn btn-soft rounded-full px-3 py-1.5 text-[12px]">
          к заказам
        </Link>
      </div>
      {data?.topOverdue?.length ? (
        <div className="mt-3 space-y-1">
          {data.topOverdue.slice(0, 3).map((o) => (
            <div key={o.id} className="text-[12px] text-red-600">
              #{o.id.slice(-8)} · {o.status} · +{o.overdueMinutes} мин
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-emerald-600">Просрочек по SLA нет.</div>
      )}
    </div>
  )
}
