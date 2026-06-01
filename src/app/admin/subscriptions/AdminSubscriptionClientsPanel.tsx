'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { periodLabel } from '@/lib/subscription-config'
import { formatTelegramContact, telegramUserUrl } from '@/lib/telegram-contact'
import type { AdminSubscriptionRow } from '@/lib/get-admin-subscriptions'
import { IconTrash } from '@/components/ui/icons'
import { AdminSubscriptionNav } from './AdminSubscriptionNav'

type SubRow = AdminSubscriptionRow

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const DELIVERY_STATUS: Record<string, string> = {
  SCHEDULED: 'запланирована',
  CONFIRMED: 'в готовке',
  DELIVERED: 'доставлена',
  SKIPPED: 'пропущена',
  CANCELLED: 'отменена',
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

type CalendarEntry = {
  date: Date
  key: string
  count: number
  items: { sub: SubRow; delivery: SubRow['deliveries'][number]; clientName: string }[]
}

function buildCalendar(subs: SubRow[], days = 14): CalendarEntry[] {
  const today = startOfDay(new Date())
  const result: CalendarEntry[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const key = dayKey(date)
    const items: CalendarEntry['items'] = []
    for (const s of subs) {
      if (s.status !== 'ACTIVE') continue
      const clientName = s.user?.name ?? 'гость'
      for (const d of s.deliveries ?? []) {
        if (d.status === 'CANCELLED' || d.status === 'DELIVERED') continue
        const dd = startOfDay(new Date(d.scheduledDate))
        if (dayKey(dd) !== key) continue
        items.push({ sub: s, delivery: d, clientName })
      }
    }
    result.push({ date, key, count: items.length, items })
  }
  return result
}

function buildTodayQueue(subs: SubRow[]) {
  const today = dayKey(startOfDay(new Date()))
  const toSend: { sub: SubRow; clientName: string }[] = []
  const inPrep: { sub: SubRow; clientName: string }[] = []
  for (const s of subs) {
    if (s.status !== 'ACTIVE') continue
    const clientName = s.user?.name ?? 'гость'
    for (const d of s.deliveries ?? []) {
      if (d.status === 'CANCELLED' || d.status === 'DELIVERED') continue
      const dd = dayKey(startOfDay(new Date(d.scheduledDate)))
      if (dd !== today) continue
      if (d.status === 'SCHEDULED') toSend.push({ sub: s, clientName })
      else inPrep.push({ sub: s, clientName })
    }
  }
  return { toSend, inPrep }
}

function formatDeliveryDays(days: number[]) {
  if (!days.length) return '—'
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAYS_SHORT[d]).join(', ')
}

type ClientRow = {
  userId: string
  name: string
  telegramUsername: string | null
  telegramId: string | null
  photo: string | null
  subs: SubRow[]
  active: number
  revenue: number
}

function groupClients(subs: SubRow[]): ClientRow[] {
  const map = new Map<string, ClientRow>()
  for (const s of subs) {
    const uid = s.user?.id ?? `anon-${s.id}`
    const row =
      map.get(uid) ??
      ({
        userId: uid,
        name: s.user?.name ?? 'гость',
        telegramUsername: s.user?.telegramUsername ?? null,
        telegramId: s.user?.telegramId ?? null,
        photo: s.user?.telegramPhotoUrl ?? s.user?.avatar ?? null,
        subs: [],
        active: 0,
        revenue: 0,
      } satisfies ClientRow)
    row.subs.push(s)
    if (s.status === 'ACTIVE') {
      row.active += 1
      row.revenue += Number(s.price) || 0
    }
    map.set(uid, row)
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}

export function AdminSubscriptionClientsPanel({
  initialClientSubscriptions = [],
}: {
  initialClientSubscriptions?: SubRow[]
}) {
  const [loading, setLoading] = useState(true)
  const [subs, setSubs] = useState<SubRow[]>(initialClientSubscriptions)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => dayKey(startOfDay(new Date())))
  const [search, setSearch] = useState('')

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

  const clients = useMemo(() => groupClients(subs), [subs])
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.telegramUsername ?? '').toLowerCase().includes(q.replace(/^@/, '')) ||
        (c.telegramId ?? '').includes(q)
    )
  }, [clients, search])

  useEffect(() => {
    if (!selectedId && filteredClients[0]) setSelectedId(filteredClients[0].userId)
  }, [filteredClients, selectedId])

  const client = filteredClients.find((c) => c.userId === selectedId) ?? filteredClients[0]
  const activeSubs = useMemo(() => subs.filter((s) => s.status === 'ACTIVE'), [subs])
  const pendingSubs = useMemo(() => subs.filter((s) => s.status === 'PENDING'), [subs])
  const calendar = useMemo(() => buildCalendar(activeSubs, 14), [activeSubs])
  const todayQueue = useMemo(() => buildTodayQueue(activeSubs), [activeSubs])
  const selectedDay = calendar.find((d) => d.key === selectedDayKey) ?? calendar[0]
  const deliveriesToday = calendar[0]?.count ?? 0
  const deliveriesWeek = calendar.slice(0, 7).reduce((n, d) => n + d.count, 0)

  async function deleteSub(id: string) {
    if (!confirm('Удалить подписку?')) return
    const res = await fetch(`/api/admin/subscriptions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) {
      toast.success('Удалено')
      await load()
    } else toast.error(data?.error || 'Ошибка')
  }

  async function reviewSub(id: string, action: 'approve' | 'reject') {
    const label = action === 'approve' ? 'Подтвердить подписку?' : 'Отклонить заявку?'
    if (!confirm(label)) return
    const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) {
      toast.success(action === 'approve' ? 'Подписка активирована' : 'Заявка отклонена')
      await load()
    } else toast.error(data?.error || 'Ошибка')
  }

  return (
    <main className="ui-container ui-screen flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden !pb-6 pt-1">
      <header className="mb-3 shrink-0 space-y-2">
        <AdminSubscriptionNav />
        <p className="text-[12px] text-[color:var(--muted)]">подписчики · доставки · мини-crm</p>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-24">
        {loading ? (
          <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
        ) : clients.length === 0 ? (
          <p className="text-[13px] text-[color:var(--muted)]">Пока нет клиентских подписок.</p>
        ) : (
          <>
            {pendingSubs.length > 0 ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-amber-900">
                  на подтверждении · {pendingSubs.length}
                </p>
                <div className="space-y-2">
                  {pendingSubs.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-white px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold">{s.name}</p>
                        <p className="text-[11px] text-[color:var(--muted)]">
                          {formatTelegramContact({
                            name: s.user?.name,
                            telegramUsername: s.user?.telegramUsername,
                            telegramId: s.user?.telegramId,
                          }) || 'гость'} · {formatPrice(s.price)} · {s.periodDays ?? '—'} дн.
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => reviewSub(s.id, 'approve')}
                          className="rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-[12px] font-semibold text-white"
                        >
                          подтвердить
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewSub(s.id, 'reject')}
                          className="rounded-lg border border-[color:var(--stroke)] px-3 py-1.5 text-[12px] font-semibold"
                        >
                          отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'клиентов', value: String(clients.length) },
                { label: 'активных', value: String(activeSubs.length) },
                { label: 'сегодня', value: String(deliveriesToday) },
                { label: 'за 7 дн.', value: String(deliveriesWeek) },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5"
                >
                  <p className="text-[20px] font-bold tabular-nums">{s.value}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                оборот активных
              </p>
              <p className="text-[22px] font-bold tabular-nums text-[color:var(--accent)]">
                {formatPrice(activeSubs.reduce((n, s) => n + Number(s.price), 0))}
              </p>
            </div>

            {(todayQueue.inPrep.length > 0 || todayQueue.toSend.length > 0) && (
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  сегодня · все клиенты
                </p>
                <div className="space-y-2">
                  {todayQueue.inPrep.length > 0 && (
                    <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">в готовке</p>
                      <p className="mt-1 text-[13px] font-medium">
                        {todayQueue.inPrep.map((t) => `${t.clientName} · ${t.sub.name}`).join(' · ')}
                      </p>
                    </div>
                  )}
                  {todayQueue.toSend.length > 0 && (
                    <div className="rounded-xl border border-[color:var(--stroke)] px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">к отправке</p>
                      <p className="mt-1 text-[13px] font-medium">
                        {todayQueue.toSend.map((t) => `${t.clientName} · ${t.sub.name}`).join(' · ')}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                график доставок · 14 дней
              </p>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {calendar.map((d) => {
                  const isToday = d.key === dayKey(startOfDay(new Date()))
                  const isSel = d.key === selectedDayKey
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setSelectedDayKey(d.key)}
                      className={cn(
                        'flex min-w-[52px] shrink-0 flex-col items-center rounded-xl border px-2 py-2 transition',
                        isSel ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10' : 'border-[color:var(--stroke)]'
                      )}
                    >
                      <span className="text-[10px] text-[color:var(--muted)]">
                        {WEEKDAYS_SHORT[d.date.getDay()]}
                      </span>
                      <span className="text-[15px] font-bold tabular-nums">{d.date.getDate()}</span>
                      <span
                        className={cn(
                          'mt-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                          d.count > 0 ? 'bg-[color:var(--text)] text-[color:var(--surface)]' : 'text-[color:var(--muted)]'
                        )}
                      >
                        {d.count}
                      </span>
                      {isToday ? (
                        <span className="mt-0.5 text-[8px] font-semibold uppercase text-[color:var(--primary)]">
                          сег
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              {selectedDay && selectedDay.count > 0 ? (
                <div className="mt-3 space-y-2">
                  {selectedDay.items.map(({ sub, delivery, clientName }) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--stroke)] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{clientName}</p>
                        <p className="truncate text-[12px] text-[color:var(--muted)]">{sub.name}</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-[color:var(--muted)]">
                        {DELIVERY_STATUS[delivery.status] ?? delivery.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : selectedDay ? (
                <p className="mt-2 text-[12px] text-[color:var(--muted)]">Нет доставок на этот день.</p>
              ) : null}
            </section>

            <section>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="поиск по имени или @telegram"
                className="input mb-3 w-full rounded-xl px-3 py-2 text-[13px]"
              />

              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                клиенты
              </p>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                {filteredClients.map((c) => (
                  <button
                    key={c.userId}
                    type="button"
                    onClick={() => setSelectedId(c.userId)}
                    className={cn(
                      'flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-3 transition',
                      c.userId === selectedId
                        ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/5'
                        : 'border-[color:var(--stroke)]'
                    )}
                  >
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-black/5">
                      {c.photo ? (
                        <img src={c.photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[18px] font-bold text-[color:var(--muted)]">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="max-w-[80px] truncate text-[11px] font-medium">{c.name}</span>
                    <span className="text-[10px] text-[color:var(--muted)]">{c.active} акт.</span>
                  </button>
                ))}
              </div>
            </section>

            {client ? (
              <section className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/5">
                      {client.photo ? (
                        <img src={client.photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[22px] font-bold text-[color:var(--muted)]">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold">{client.name}</p>
                      {(() => {
                        const handle = formatTelegramContact(client)
                        const url = telegramUserUrl(client.telegramId)
                        if (url) {
                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block text-[13px] font-semibold text-[color:var(--primary)]"
                            >
                              {handle}
                            </a>
                          )
                        }
                        return (
                          <p className="mt-1 text-[13px] font-semibold text-[color:var(--muted)]">{handle}</p>
                        )
                      })()}
                      <p className="mt-2 text-[12px] text-[color:var(--muted)]">
                        {client.active} активных · {formatPrice(client.revenue)} оборот
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  подписки
                </p>
                {client.subs.map((s) => {
                  const upcoming = (s.deliveries ?? [])
                    .filter((d) => d.status !== 'CANCELLED' && d.status !== 'DELIVERED')
                    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                    .slice(0, 4)
                  return (
                    <div key={s.id} className="rounded-xl border border-[color:var(--stroke)] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{s.name}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                s.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-black/5 text-[color:var(--muted)]'
                              )}
                            >
                              {s.statusLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-[color:var(--muted)]">
                            {formatPrice(s.price)} · {periodLabel(s.periodDays)} · {s.personCount} перс.
                          </p>
                          <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">
                            дни: {formatDeliveryDays(s.deliveryDays)}
                            {s.deliveryTime ? ` · ${s.deliveryTime}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteSub(s.id)}
                          className="shrink-0 rounded-full p-2 text-red-600 hover:bg-red-50"
                          title="удалить"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>

                      {s.items.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">рацион</p>
                          <ul className="mt-1 space-y-0.5">
                            {s.items.map((it) => (
                              <li key={it.id} className="text-[12px]">
                                {it.quantity > 1 ? `${it.quantity}× ` : ''}
                                {it.dish?.name ?? '—'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {upcoming.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                            ближайшие доставки
                          </p>
                          <ul className="mt-1 space-y-1">
                            {upcoming.map((d) => {
                              const dt = new Date(d.scheduledDate)
                              return (
                                <li key={d.id} className="flex justify-between text-[12px]">
                                  <span>
                                    {dt.toLocaleDateString('ru-RU', {
                                      weekday: 'short',
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                  <span className="text-[color:var(--muted)]">
                                    {DELIVERY_STATUS[d.status] ?? d.status}
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}
