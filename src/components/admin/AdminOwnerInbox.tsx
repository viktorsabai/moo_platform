'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useVenue } from '@/lib/venue-context'
import { cn } from '@/lib/utils'
import {
  filterUnseenInboxItems,
  markOwnerInboxSeen,
  OWNER_INBOX_SEEN_EVENT,
  type OwnerInboxItemClient,
} from '@/lib/owner-inbox-client'

const ACTION_LABEL: Record<OwnerInboxItemClient['kind'], string> = {
  order: 'Открыть заказ',
  subscription: 'Подписчики',
  lead: 'Заявка',
}

export function AdminOwnerInbox({
  subscriptionRequestLeads = 0,
  restaurantName,
}: {
  subscriptionRequestLeads?: number
  restaurantName?: string
}) {
  const { restaurantId } = useVenue()
  const [items, setItems] = useState<OwnerInboxItemClient[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshotUnseen, setSnapshotUnseen] = useState<OwnerInboxItemClient[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/inbox', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.items)) {
        const nextItems = data.items as OwnerInboxItemClient[]
        setItems(nextItems)
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

  useEffect(() => {
    const onSeen = () => void load()
    window.addEventListener(OWNER_INBOX_SEEN_EVENT, onSeen)
    return () => window.removeEventListener(OWNER_INBOX_SEEN_EVENT, onSeen)
  }, [load])

  const unseen = useMemo(
    () => filterUnseenInboxItems(restaurantId, items),
    [restaurantId, items]
  )
  const displayNew = snapshotUnseen.length > 0 ? snapshotUnseen : unseen
  const hasNewSnapshot = snapshotUnseen.length > 0
  const taskList = useMemo(() => {
    const base = hasNewSnapshot ? displayNew : items.length > 0 ? items : displayNew
    const rows = [...base]
    if (subscriptionRequestLeads > 0) {
      rows.unshift({
        id: 'subscription-request-leads',
        kind: 'subscription',
        href: '/admin/subscription-leads',
        label: `Запрос на подписку · ${subscriptionRequestLeads}`,
        subtitle: 'Гость хочет оформить рацион',
        createdAt: new Date().toISOString(),
      })
    }
    return rows.slice(0, 5)
  }, [displayNew, hasNewSnapshot, items, subscriptionRequestLeads])

  const taskCount = taskList.length
  const hasUnseen = displayNew.length > 0

  function markCurrentSeen() {
    if (!restaurantId) return
    markOwnerInboxSeen(restaurantId, displayNew.length ? displayNew : items)
    setSnapshotUnseen([])
    void load()
  }

  return (
    <section id="inbox" className="mb-4 overflow-hidden rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]">
      <div className="px-4 pt-4 pb-3">
        {restaurantName ? (
          <div className="text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-[color:var(--text)]">
            {restaurantName}
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
            {loading ? 'задачи…' : taskCount > 0 ? `задачи · ${taskCount}` : 'задачи · всё чисто'}
          </h2>
          {hasUnseen ? (
            <button
              type="button"
              onClick={markCurrentSeen}
              className="text-[11px] font-semibold text-[color:var(--primary)]"
            >
              просмотрено
            </button>
          ) : null}
        </div>
      </div>

      {taskCount === 0 && !loading ? (
        <p className="border-t border-[color:var(--stroke)] px-4 py-3 text-[12px] text-[color:var(--muted)]">
          Новые заказы, подписки и заявки появятся здесь — тап откроет нужный экран.
        </p>
      ) : null}

      {taskList.length > 0 ? (
        <ul className="divide-y divide-[color:var(--stroke)] border-t border-[color:var(--stroke)]">
          {taskList.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <Link
                href={item.href}
                prefetch={false}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition active:bg-black/[0.03]',
                  hasUnseen && displayNew.some((u) => u.id === item.id && u.kind === item.kind)
                    ? 'bg-[color:color-mix(in_srgb,var(--primary)_6%,transparent)]'
                    : ''
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[color:var(--text)]">{item.label}</p>
                  {item.subtitle ? (
                    <p className="mt-0.5 truncate text-[12px] text-[color:var(--muted)]">{item.subtitle}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-[color:var(--primary)]">
                  {ACTION_LABEL[item.kind]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
