'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useVenue } from '@/lib/venue-context'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { Badge, Btn, Card, Empty, Screen, fmtThb } from '@/components/kit'

type Order = { id: string; status: string; paymentStatus?: string; totalAmount: number; createdAt: string; itemsCount?: number; items: Array<{ quantity: number; dish?: { name?: string } | null; name?: string }> }
type Sub = { id: string; name: string; status: string; price: number; nextDelivery?: string | null; deliveries?: Array<{ scheduledDate: string; status: string }> }

const LIVE = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'])
const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  PENDING: { label: 'ждёт подтверждения', tone: 'warn' },
  CONFIRMED: { label: 'принят', tone: 'ok' },
  PREPARING: { label: 'готовим', tone: 'warn' },
  READY: { label: 'готов', tone: 'ok' },
  OUT_FOR_DELIVERY: { label: 'курьер в пути', tone: 'ok' },
  DELIVERED: { label: 'доставлен', tone: 'muted' },
  CANCELLED: { label: 'отменён', tone: 'danger' },
}
const SUB_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  PENDING: { label: 'ждёт подтверждения', tone: 'warn' },
  ACTIVE: { label: 'активен', tone: 'ok' },
  PAUSED: { label: 'на паузе', tone: 'muted' },
  CANCELLED: { label: 'отменён', tone: 'danger' },
  EXPIRED: { label: 'закончился', tone: 'muted' },
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export default function OrdersPage() {
  const { restaurantId, settings } = useVenue()
  const { status: auth } = useSession()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [subs, setSubs] = useState<Sub[]>([])

  const headers = useMemo<Record<string, string>>(
    () => ({ ...telegramInitHeaderRecord(), ...(restaurantId && restaurantId !== 'default' ? { 'x-ufo-restaurant': restaurantId } : {}) }),
    [restaurantId]
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const get = (u: string) => fetch(u, { cache: 'no-store', credentials: 'include', headers }).then((r) => r.json()).catch(() => null)
      const [o, s] = await Promise.all([get('/api/orders'), settings.subscriptionEnabled ? get('/api/subscriptions') : null])
      if (cancelled) return
      setOrders(Array.isArray(o?.orders) ? o.orders.map((x: any) => ({ ...x, totalAmount: Number(x.totalAmount ?? 0), items: Array.isArray(x.items) ? x.items : [] })) : [])
      setSubs(Array.isArray(s?.subscriptions) ? s.subscriptions.map((x: any) => ({ ...x, price: Number(x.price ?? 0) })) : [])
    }
    void load()
    const t = setInterval(load, 20_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [headers, settings.subscriptionEnabled])

  const live = (orders ?? []).filter((o) => LIVE.has(o.status))
  const past = (orders ?? []).filter((o) => !LIVE.has(o.status))
  const liveSubs = subs.filter((s) => s.status === 'ACTIVE' || s.status === 'PENDING' || s.status === 'PAUSED')

  const itemsLine = (o: Order) =>
    o.items
      .slice(0, 3)
      .map((it) => `${it.quantity}× ${it.dish?.name ?? it.name ?? '—'}`)
      .join(', ') + (o.items.length > 3 ? ` +${o.items.length - 3}` : '')

  return (
    <Screen title="заказы">
      {auth === 'unauthenticated' ? (
        <Empty title="войдите, чтобы видеть заказы" hint="откройте приложение из Telegram" action={<Link href="/profile" className="text-[14px] font-semibold text-[color:var(--text)] underline">в профиль</Link>} />
      ) : orders === null ? (
        <div className="flex flex-col gap-2.5" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-[20px] bg-[color:var(--surface)]" />)}</div>
      ) : !orders.length && !liveSubs.length ? (
        <Empty title="заказов пока нет" hint="первый заказ появится здесь" action={<Link href="/"><Btn>в меню</Btn></Link>} />
      ) : (
        <div className="flex flex-col gap-4">
          {live.length ? (
            <Group title="сейчас">
              {live.map((o) => (
                <OrderCard key={o.id} o={o} line={itemsLine(o)} />
              ))}
            </Group>
          ) : null}

          {liveSubs.length ? (
            <Group title="рационы">
              {liveSubs.map((s) => {
                const st = SUB_STATUS[s.status] ?? { label: s.status, tone: 'muted' as const }
                const next = s.nextDelivery ?? s.deliveries?.find((d) => d.status === 'SCHEDULED' || d.status === 'CONFIRMED')?.scheduledDate
                return (
                  <Link key={s.id} href={`/subscriptions/${s.id}`} prefetch={false}>
                    <Card>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-[color:var(--text)]">{s.name}</div>
                          <div className="text-[13px] text-[color:var(--muted)]">
                            {next ? `следующая доставка ${new Date(next).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}` : fmtThb(s.price)}
                          </div>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </Group>
          ) : settings.subscriptionEnabled ? (
            <Link href="/subscriptions/new" prefetch={false} className="flex h-12 items-center justify-between rounded-[16px] bg-[color:var(--ok-bg)] px-4 text-[14px] font-semibold text-[color:var(--ok)]">
              собрать рацион на неделю <span aria-hidden>›</span>
            </Link>
          ) : null}

          {past.length ? (
            <Group title="раньше">
              {past.slice(0, 20).map((o) => (
                <OrderCard key={o.id} o={o} line={itemsLine(o)} />
              ))}
            </Group>
          ) : null}
        </div>
      )}
    </Screen>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  )
}

function OrderCard({ o, line }: { o: Order; line: string }) {
  const st = STATUS[o.status] ?? { label: o.status.toLowerCase(), tone: 'muted' as const }
  const needsReceipt = o.paymentStatus === 'AWAITING_RECEIPT'
  return (
    <Link href={needsReceipt ? `/orders/${o.id}/pay` : `/orders/${o.id}`} prefetch={false}>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-[color:var(--text)]">
            #{o.id.slice(-4)} <span className="font-normal text-[color:var(--muted)]">· {fmtDate(o.createdAt)}</span>
          </div>
          <Badge tone={needsReceipt ? 'warn' : st.tone}>{needsReceipt ? 'нужен чек' : st.label}</Badge>
        </div>
        <div className="mt-1 truncate text-[13px] text-[color:var(--muted)]">{line}</div>
        <div className="mt-1 text-[14px] font-semibold text-[color:var(--text)]">{fmtThb(o.totalAmount)}</div>
      </Card>
    </Link>
  )
}
