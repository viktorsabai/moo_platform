'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useVenue } from '@/lib/venue-context'
import { cn } from '@/lib/utils'
import { IconCrown } from '@/components/ui/icons'
import {
  filterUnseenInboxItems,
  inboxBreakdownFromItems,
  markOwnerInboxSeen,
  OWNER_INBOX_SEEN_EVENT,
  type OwnerInboxItemClient,
  type OwnerInboxItemKind,
} from '@/lib/owner-inbox-client'

const KIND_LABEL: Record<OwnerInboxItemKind, string> = {
  order: 'заказ',
  subscription: 'подписка',
  lead: 'кейтеринг',
}

type InboxFilter = 'all' | OwnerInboxItemKind

type Breakdown = { orders: number; subscriptions: number; leads: number }

function breakdownLine(items: OwnerInboxItemClient[]) {
  const b = inboxBreakdownFromItems(items)
  const parts: string[] = []
  if (b.orders) parts.push(`${b.orders} ${b.orders === 1 ? 'заказ' : 'заказа'}`)
  if (b.subscriptions) parts.push(`${b.subscriptions} ${b.subscriptions === 1 ? 'подписка' : 'подписки'}`)
  if (b.leads) parts.push(`${b.leads} ${b.leads === 1 ? 'заявка' : 'заявки'}`)
  return parts.join(' · ')
}

export function AdminOwnerInbox({
  subscriptionRequestLeads = 0,
}: {
  /** NEW в SubscriptionRequestLead — отдельно от PENDING подписок. */
  subscriptionRequestLeads?: number
}) {
  const { restaurantId } = useVenue()
  const [items, setItems] = useState<OwnerInboxItemClient[]>([])
  const [breakdown, setBreakdown] = useState<Breakdown>({ orders: 0, subscriptions: 0, leads: 0 })
  const [loading, setLoading] = useState(true)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [snapshotUnseen, setSnapshotUnseen] = useState<OwnerInboxItemClient[]>([])
  const [filter, setFilter] = useState<InboxFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/inbox', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.items)) {
        const nextItems = data.items as OwnerInboxItemClient[]
        setItems(nextItems)
        setBreakdown({
          orders: Number(data.breakdown?.orders ?? 0),
          subscriptions: Number(data.breakdown?.subscriptions ?? 0),
          leads: Number(data.breakdown?.leads ?? 0),
        })
        setPendingTotal(typeof data.total === 'number' ? data.total : nextItems.length)
        const unseenNow = filterUnseenInboxItems(restaurantId, nextItems)
        if (unseenNow.length > 0) {
          setSnapshotUnseen((prev) => (prev.length ? prev : unseenNow))
        }
      }
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    void load()
  }, [load])

  const unseen = useMemo(
    () => filterUnseenInboxItems(restaurantId, items),
    [restaurantId, items]
  )
  const displayNew = snapshotUnseen.length > 0 ? snapshotUnseen : unseen
  const hasNewSnapshot = snapshotUnseen.length > 0

  useEffect(() => {
    const onSeen = () => void load()
    window.addEventListener(OWNER_INBOX_SEEN_EVENT, onSeen)
    return () => window.removeEventListener(OWNER_INBOX_SEEN_EVENT, onSeen)
  }, [load])

  const sourceList = hasNewSnapshot ? displayNew : items.length > 0 ? items : displayNew
  const filteredList = useMemo(() => {
    if (filter === 'all') return sourceList
    return sourceList.filter((i) => i.kind === filter)
  }, [sourceList, filter])

  const hubTotal = pendingTotal + subscriptionRequestLeads
  const hasUnseen = displayNew.length > 0
  const hasPending = hubTotal > 0

  function markCurrentSeen() {
    if (!restaurantId) return
    markOwnerInboxSeen(restaurantId, displayNew.length ? displayNew : items)
    setSnapshotUnseen([])
    void load()
  }

  if (loading && items.length === 0) return null

  const chips: { id: InboxFilter; label: string; count: number }[] = [
    { id: 'all', label: 'все', count: pendingTotal },
    { id: 'order', label: 'заказы', count: breakdown.orders },
    { id: 'subscription', label: 'подписки', count: breakdown.subscriptions },
    { id: 'lead', label: 'кейтеринг', count: breakdown.leads },
  ]

  if (!hasPending && !hasUnseen && subscriptionRequestLeads === 0) {
    return (
      <section
        id="inbox"
        className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 py-3"
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[color:var(--muted)]">
          <IconCrown className="h-4 w-4 shrink-0 text-[color:var(--primary)]" />
          входящие · всё обработано
        </div>
      </section>
    )
  }

  return (
    <section
      id="inbox"
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border',
        hasUnseen
          ? 'border-[color:var(--primary)]/30 bg-gradient-to-b from-[color:color-mix(in_srgb,var(--primary)_8%,transparent)] to-[color:var(--surface-strong)]'
          : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)]'
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[color:var(--stroke)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <IconCrown className="h-4 w-4 shrink-0 text-[color:var(--primary)]" aria-hidden />
            <h2 className="text-[14px] font-bold text-[color:var(--text)]">
              {hasUnseen
                ? `входящие · ${displayNew.length} ${hasNewSnapshot ? 'новых' : 'непросмотренных'}`
                : `входящие · ${hubTotal} ждут`}
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--muted)]">
            {hasUnseen
              ? breakdownLine(displayNew)
              : [
                  pendingTotal > 0 && `${pendingTotal} в очереди`,
                  subscriptionRequestLeads > 0 && `${subscriptionRequestLeads} запросов на подписку`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
        </div>
        {hasUnseen ? (
          <span className="inline-flex min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] px-1.5 text-[11px] font-extrabold text-[color:var(--surface)]">
            {displayNew.length > 99 ? '99+' : displayNew.length}
          </span>
        ) : hubTotal > 0 ? (
          <span className="inline-flex min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-extrabold text-white">
            {hubTotal > 99 ? '99+' : hubTotal}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[color:var(--stroke)] px-3 py-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition',
              filter === chip.id
                ? 'bg-[color:var(--primary)] text-white'
                : 'bg-[color:var(--surface)] text-[color:var(--muted)] ring-1 ring-[color:var(--stroke)]'
            )}
          >
            {chip.label}
            {chip.count > 0 ? ` ${chip.count}` : ''}
          </button>
        ))}
        {subscriptionRequestLeads > 0 ? (
          <Link
            href="/admin/subscription-leads"
            prefetch={false}
            className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200"
          >
            запросы {subscriptionRequestLeads}
          </Link>
        ) : null}
      </div>

      {filteredList.length > 0 ? (
        <ul className="divide-y divide-[color:var(--stroke)]">
          {filteredList.slice(0, 8).map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <Link
                href={item.href}
                prefetch={false}
                className="flex items-center justify-between gap-3 px-4 py-3 transition active:bg-black/[0.03]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[color:var(--text)]">{item.label}</p>
                  {item.subtitle ? (
                    <p className="mt-0.5 truncate text-[12px] text-[color:var(--muted)]">{item.subtitle}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  {KIND_LABEL[item.kind]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[12px] text-[color:var(--muted)]">В этой категории сейчас пусто.</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--stroke)] px-3 py-2.5">
        {hasUnseen ? (
          <button
            type="button"
            onClick={markCurrentSeen}
            className="text-[12px] font-semibold text-[color:var(--primary)]"
          >
            отметить просмотренным
          </button>
        ) : null}
        <Link href="/admin/orders" prefetch={false} className="text-[12px] font-medium text-[color:var(--muted)]">
          заказы
        </Link>
        <Link
          href="/admin/subscriptions/clients"
          prefetch={false}
          className="text-[12px] font-medium text-[color:var(--muted)]"
        >
          подписчики
        </Link>
        <Link href="/admin/leads" prefetch={false} className="text-[12px] font-medium text-[color:var(--muted)]">
          кейтеринг
        </Link>
      </div>

      {hasPending && !hasUnseen ? (
        <p className="border-t border-[color:var(--stroke)] px-4 py-2 text-[11px] text-[color:var(--muted)]">
          Уже просмотрено — обработайте в разделах ниже.
        </p>
      ) : null}
    </section>
  )
}
