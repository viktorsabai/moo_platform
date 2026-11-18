'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useOrderStore } from '@/store/order-store'
import { formatDateTime, formatPrice } from '@/lib/utils'
import { ORDER_STATUSES } from '@/lib/constants'
import { Screen, Card } from '@/components/kit'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

export default function OrderDetailsPage() {
  const params = useParams<{ orderId: string }>()
  const orderId = String(params?.orderId || '')
  const orders = useOrderStore((state) => state.orders)
  const setOrders = useOrderStore((state) => state.setOrders)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/orders', {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord() },
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !Array.isArray(data?.orders)) return
        const normalized = data.orders.map((o: any) => ({
          ...o,
          createdAt: o?.createdAt ? new Date(o.createdAt) : new Date(),
          deliveryTime: o?.deliveryTime ? new Date(o.deliveryTime) : undefined,
          totalAmount: Number(o?.totalAmount ?? 0),
          items: Array.isArray(o?.items) ? o.items : [],
        }))
        if (!cancelled) setOrders(normalized as any)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    const interval = setInterval(load, 20000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [setOrders])

  const order = useMemo(() => orders.find((o: any) => String(o.id) === orderId) ?? null, [orders, orderId])
  const statusLabel = order ? (ORDER_STATUSES as any)[String(order.status ?? '').toUpperCase()] ?? String(order.status ?? '') : ''

  return (
    <Screen back="/orders" title="заказ" subtitle={order ? `#${String(order.id).slice(-8)}` : undefined}>
      {!loaded ? (
        <Card>
          <div className="text-[13px] text-[color:var(--text)]">загружаем заказ...</div>
        </Card>
      ) : !order ? (
        <Card>
          <div className="text-[13px] text-[color:var(--text)]">заказ не найден</div>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <div className="text-[12px] text-[color:var(--muted)]">статус</div>
            <div className="mt-1 text-[17px] font-semibold text-[color:var(--text)]">{statusLabel}</div>
            <div className="mt-2 text-[12px] text-[color:var(--muted)]">создан: {formatDateTime(order.createdAt)}</div>
            <div className="mt-1 text-[12px] text-[color:var(--muted)]">итого: {formatPrice(order.totalAmount)}</div>
          </Card>
          <Card>
            <div className="text-[12px] text-[color:var(--muted)]">адрес</div>
            <div className="mt-1 text-[13px] text-[color:var(--text)]">{String(order?.address?.street ?? '—')}</div>
          </Card>
          <Card>
            <div className="text-[12px] text-[color:var(--muted)]">позиции</div>
            <div className="mt-2 space-y-1">
              {Array.isArray(order.items) && order.items.length > 0 ? (
                order.items.map((it: any) => (
                  <div key={it.id} className="flex items-start justify-between gap-2 text-[13px]">
                    <span className="min-w-0 text-[color:var(--text)]">
                      <span className="block">
                        {it?.dish?.name || it?.storeVariant?.name || 'товар'} × {Number(it?.quantity ?? 1)}
                      </span>
                      {Array.isArray(it?.modifierLabels) && it.modifierLabels.length > 0 ? (
                        <span className="mt-0.5 block truncate text-[11px] text-[color:var(--muted)]">
                          {it.modifierLabels.join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-[color:var(--muted)]">{formatPrice(Number(it?.price ?? 0))}</span>
                  </div>
                ))
              ) : (
                <div className="text-[12px] text-[color:var(--muted)]">нет данных по позициям</div>
              )}
            </div>
          </Card>
        </div>
      )}
    </Screen>
  )
}
