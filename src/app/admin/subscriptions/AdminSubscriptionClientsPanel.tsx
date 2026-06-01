'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { IconTrash } from '@/components/ui/icons'
import type { ClientSubscription } from './AdminSubscriptionsClient'
import { AdminSubscriptionNav } from './AdminSubscriptionNav'

function buildTodayTodo(subs: ClientSubscription[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const toSend: { subName: string }[] = []
  const inPrep: { subName: string }[] = []
  for (const s of subs) {
    for (const d of s.deliveries ?? []) {
      if (d.status === 'CANCELLED' || d.status === 'DELIVERED') continue
      const dDate = new Date(d.scheduledDate)
      dDate.setHours(0, 0, 0, 0)
      if (dDate.getTime() !== today.getTime()) continue
      const label = { subName: s.name }
      if (d.status === 'SCHEDULED') toSend.push(label)
      else inPrep.push(label)
    }
  }
  return { toSend, inPrep }
}

export function AdminSubscriptionClientsPanel({
  initialClientSubscriptions = [],
}: {
  initialClientSubscriptions?: ClientSubscription[]
}) {
  const [loading, setLoading] = useState(true)
  const [subs, setSubs] = useState<ClientSubscription[]>(initialClientSubscriptions)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/subscriptions', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.subscriptions)) {
        setSubs(data.subscriptions)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const clients = (() => {
    const map = new Map<string, { userId: string; name: string; photo: string | null; subs: ClientSubscription[]; active: number; total: number }>()
    for (const s of subs) {
      const uid = s.user?.id ?? `anon-${s.id}`
      const row = map.get(uid) ?? {
        userId: uid,
        name: s.user?.name ?? 'гость',
        photo: s.user?.telegramPhotoUrl ?? s.user?.avatar ?? null,
        subs: [],
        active: 0,
        total: 0,
      }
      row.subs.push(s)
      if (s.status === 'ACTIVE') row.active += 1
      row.total += Number(s.price) || 0
      map.set(uid, row)
    }
    return Array.from(map.values())
  })()

  useEffect(() => {
    if (!selectedId && clients[0]) setSelectedId(clients[0].userId)
  }, [clients, selectedId])

  const client = clients.find((c) => c.userId === selectedId) ?? clients[0]
  const todayTodo = client ? buildTodayTodo(client.subs) : { toSend: [], inPrep: [] }

  return (
    <main className="ui-container ui-screen flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden !pb-20 pt-1">
      <header className="mb-3 shrink-0 space-y-2">
        <AdminSubscriptionNav />
        <p className="text-[12px] text-[color:var(--muted)]">активные абонементы и доставки на сегодня</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? (
        <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
      ) : clients.length === 0 ? (
        <p className="text-[13px] text-[color:var(--muted)]">Пока нет клиентских подписок.</p>
      ) : (
        <div className="space-y-4">
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {clients.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => setSelectedId(c.userId)}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-3',
                  c.userId === selectedId ? 'border-[color:var(--primary)]' : 'border-[color:var(--stroke)]'
                )}
              >
                <span className="text-[18px] font-bold">{c.name.charAt(0).toUpperCase()}</span>
                <span className="max-w-[80px] truncate text-[11px] font-medium">{c.name}</span>
              </button>
            ))}
          </div>
          {client ? (
            <>
              <div className="rounded-2xl border border-[color:var(--stroke)] p-4">
                <p className="font-bold">{client.name}</p>
                <p className="text-[12px] text-[color:var(--muted)]">{client.active} активных · {formatPrice(client.total)}/мес</p>
              </div>
              {(todayTodo.toSend.length > 0 || todayTodo.inPrep.length > 0) && (
                <p className="text-[12px] text-[color:var(--muted)]">
                  сегодня: {todayTodo.inPrep.map((t) => t.subName).join(', ')} {todayTodo.toSend.map((t) => t.subName).join(', ')}
                </p>
              )}
              <div className="space-y-2">
                {client.subs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-[color:var(--stroke)] px-4 py-3">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-[12px] text-[color:var(--muted)]">{formatPrice(s.price)}/мес · {s.statusLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Удалить подписку?')) return
                        const res = await fetch(`/api/admin/subscriptions?id=${encodeURIComponent(s.id)}`, { method: 'DELETE', credentials: 'include' })
                        const data = await res.json().catch(() => null)
                        if (res.ok && data?.ok) {
                          toast.success('Удалено')
                          await load()
                        } else toast.error(data?.error || 'Ошибка')
                      }}
                      className="rounded-full p-2 text-red-600 hover:bg-red-50"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
      </div>
    </main>
  )
}
