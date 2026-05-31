'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDateTime, formatPrice } from '@/lib/utils'
import { useOrderStore } from '@/store/order-store'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { useVenue } from '@/lib/venue-context'
import { ORDER_STATUSES } from '@/lib/constants'

export default function OrdersPage() {
  const orders = useOrderStore((state) => state.orders)
  const setOrders = useOrderStore((state) => state.setOrders)
  const { restaurantId: venueRestaurantId } = useVenue()
  const [from, setFrom] = useState<string | null>(null)

  useEffect(() => {
    try {
      setFrom(new URLSearchParams(window.location.search).get('from'))
    } catch {
      setFrom(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const rid = venueRestaurantId
        const restaurantHeaders: HeadersInit =
          rid && String(rid) !== 'default' ? { 'x-ufo-restaurant': String(rid) } : {}
        const res = await fetch('/api/orders', {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord(), ...restaurantHeaders } as HeadersInit,
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
      }
    }
    load()
    const interval = setInterval(load, 20000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [setOrders, venueRestaurantId])

  const orderBlocks = useMemo(() => {
    return orders.map((order: any) => {
      const itemsCount = (order as any)?.itemsCount ?? order.items?.length ?? 0
      const label = `заказ #${String(order.id ?? '').slice(-8)}`
      const s = String(order.status ?? '').toUpperCase()
      const statusLabel = (ORDER_STATUSES as any)[s] ?? s.toLowerCase()
      const href = `/orders/${encodeURIComponent(String(order.id))}`

      return (
        <details key={order.id} className="border-t border-[color:var(--stroke)] first:border-t-0">
          <summary className="cursor-pointer list-none px-1 py-3 [&::-webkit-details-marker]:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-extrabold text-[color:var(--text)]">{label}</div>
                <div className="ui-muted mt-0.5 text-[12px]">
                  {itemsCount} {itemsCount === 1 ? 'позиция' : 'позиций'} · {formatDateTime(order.createdAt)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[13px] font-semibold tabular-nums text-[color:var(--text)]">
                  {formatPrice(order.totalAmount)}
                </div>
                <div className="mt-0.5 max-w-[140px] text-right text-[11px] font-medium leading-snug text-[color:var(--muted)]">
                  {statusLabel}
                </div>
              </div>
            </div>
          </summary>
          <div className="border-t border-[color:var(--stroke)] px-1 pb-3 pt-2">
            <Link href={href} prefetch={false} className="block">
              <span className="inline-flex h-9 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[12px] font-semibold text-[color:var(--text)] transition active:opacity-80">
                подробнее
              </span>
            </Link>
          </div>
        </details>
      )
    })
  }, [orders])

  const totalOrders = orders.length
  const totalSpent = orders.reduce((sum, o: any) => sum + Number(o?.totalAmount ?? 0), 0)

  const backHref = from === 'admin' ? '/admin' : '/profile'

  return (
    <main className="ui-container ui-screen">
      <PageHeader
        backHref={backHref}
        title="мои заказы"
        subtitle={orders.length > 0 ? `${orders.length} заказов` : undefined}
      />

      {orders.length === 0 ? (
        <div className="ui-surface-card p-6 text-center">
          <div className="ui-body">заказов пока нет</div>
          <Link href="/menu" prefetch={false} scroll={false} className="mt-4 block">
            <Button variant="primary" fullWidth>
              меню
            </Button>
          </Link>
        </div>
      ) : (
        <div className="ui-surface-card overflow-hidden px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--stroke)] px-1 pb-3">
            <div className="text-[12px] font-semibold text-[color:var(--muted)]">
              всего <span className="tabular-nums text-[color:var(--text)]">{totalOrders}</span>
            </div>
            <div className="text-[12px] font-semibold text-[color:var(--muted)]">
              потрачено{' '}
              <span className="tabular-nums text-[15px] font-extrabold text-[color:var(--text)]">{formatPrice(totalSpent)}</span>
            </div>
          </div>
          <p className="ui-muted border-b border-[color:var(--stroke)] px-1 py-2 text-[11px] leading-snug">
            отзывы к заказам — скоро
          </p>
          <div>{orderBlocks}</div>
        </div>
      )}
    </main>
  )
}
