'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useVenue } from '@/lib/venue-context'
import { cn } from '@/lib/utils'
import { IconCrown } from '@/components/ui/icons'
import {
  filterUnseenInboxItems,
  inboxBreakdownFromItems,
  OWNER_INBOX_SEEN_EVENT,
  type OwnerInboxItemClient,
} from '@/lib/owner-inbox-client'

const KIND_LABEL: Record<OwnerInboxItemClient['kind'], string> = {
  order: 'заказ',
  subscription: 'подписка',
  lead: 'кейтеринг',
}

function breakdownLine(items: OwnerInboxItemClient[]) {
  const b = inboxBreakdownFromItems(items)
  const parts: string[] = []
  if (b.orders) parts.push(`${b.orders} ${b.orders === 1 ? 'заказ' : 'заказа'}`)
  if (b.subscriptions) parts.push(`${b.subscriptions} ${b.subscriptions === 1 ? 'подписка' : 'подписки'}`)
  if (b.leads) parts.push(`${b.leads} ${b.leads === 1 ? 'заявка' : 'заявки'}`)
  return parts.join(' · ')
}

export function AdminOwnerInbox() {
  const { restaurantId } = useVenue()
  const [items, setItems] = useState<OwnerInboxItemClient[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [snapshotUnseen, setSnapshotUnseen] = useState<OwnerInboxItemClient[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/inbox', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.items)) {
        const nextItems = data.items as OwnerInboxItemClient[]
        setItems(nextItems)
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

  if (loading && items.length === 0) return null

  const hasPending = pendingTotal > 0
  const hasUnseen = displayNew.length > 0

  if (!hasPending && !hasUnseen) {
    return (
      <section
        id="inbox"
        className="mb-4 rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 py-3"
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[color:var(--muted)]">
          <IconCrown className="h-4 w-4 shrink-0 text-amber-500" />
          входящие · всё просмотрено
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
          ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/90 to-[color:var(--surface-strong)]'
          : 'border-[color:var(--stroke)] bg-[color:var(--surface-strong)]'
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-amber-200/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconCrown className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <h2 className="text-[14px] font-bold text-[color:var(--text)]">
              {hasUnseen
                ? `входящие · ${displayNew.length} ${hasNewSnapshot ? 'новых' : 'непросмотренных'}`
                : 'входящие · в работе'}
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--muted)]">
            {hasUnseen ? breakdownLine(displayNew) : `${pendingTotal} ${pendingTotal === 1 ? 'заявка ждёт' : 'заявок ждут'} обработки`}
          </p>
        </div>
        {hasUnseen ? (
          <span className="inline-flex min-h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-extrabold text-white">
            {displayNew.length > 99 ? '99+' : displayNew.length}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-[color:var(--stroke)]">
        {(hasUnseen ? displayNew : items).slice(0, 6).map((item) => (
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

      {hasPending && !hasUnseen ? (
        <p className="border-t border-[color:var(--stroke)] px-4 py-2.5 text-[11px] text-[color:var(--muted)]">
          Вы уже видели эти заявки — обработайте их в разделах ниже.
        </p>
      ) : null}
    </section>
  )
}
