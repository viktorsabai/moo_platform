'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '@/components/kit'
import type { OwnerInboxItemClient } from '@/lib/owner-inbox-client'

/*
 * «Ждут ответа»: заявки на рацион и запросы гостей. Заказы сюда не попадают —
 * они в живом списке ниже. Пусто — блока нет.
 */
export function AdminWaiting({ subscriptionRequestLeads = 0 }: { subscriptionRequestLeads?: number }) {
  const [items, setItems] = useState<OwnerInboxItemClient[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/owner/inbox', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.items)) setItems((d.items as OwnerInboxItemClient[]).filter((i) => i.kind !== 'order'))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const rows = [
    ...(subscriptionRequestLeads > 0
      ? [{ key: 'sub-leads', href: '/admin/rations', label: `хотят рацион · ${subscriptionRequestLeads}`, hint: 'гость оставил запрос на подписку' }]
      : []),
    ...items.map((i) => ({ key: `${i.kind}:${i.id}`, href: i.href, label: i.label, hint: i.subtitle ?? '' })),
  ].slice(0, 6)

  if (!rows.length) return null

  return (
    <section>
      <h2 className="mb-2 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">ждут ответа · {rows.length}</h2>
      <Card className="!py-1">
        {rows.map((r, i) => (
          <Link key={r.key} href={r.href} prefetch={false} className={i > 0 ? 'flex min-h-[52px] items-center gap-3 border-t border-[color:var(--stroke)] py-2' : 'flex min-h-[52px] items-center gap-3 py-2'}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--warn)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-[color:var(--text)]">{r.label}</span>
              {r.hint ? <span className="block truncate text-[12.5px] text-[color:var(--muted)]">{r.hint}</span> : null}
            </span>
            <span className="text-[16px] text-[color:var(--muted)]" aria-hidden>›</span>
          </Link>
        ))}
      </Card>
    </section>
  )
}
