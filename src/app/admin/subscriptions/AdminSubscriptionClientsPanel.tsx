'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { periodLabel } from '@/lib/subscription-config'
import { MEAL_SLOT_LABEL, parseMealSlot } from '@/lib/subscription-meal-slots'
import type { AdminSubscriptionRow } from '@/lib/get-admin-subscriptions'
import { buildDeliveryCalendar, buildKitchenPrepForDay } from '@/lib/subscription-kitchen-prep'
import { GuestClientCard, guestClientFromSubscriptionUser } from '@/components/ui/GuestClientCard'
import { PillTabToggle } from '@/components/ui/PillTabToggle'
import { IconTrash } from '@/components/ui/icons'
import { AdminSubscriptionNav } from './AdminSubscriptionNav'

type SubRow = AdminSubscriptionRow
type PanelTab = 'today' | 'clients'

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

function formatDeliveryDays(days: number[]) {
  if (!days.length) return '—'
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAYS_SHORT[d]).join(', ')
}

function formatDayTitle(key: string) {
  const d = new Date(`${key}T12:00:00`)
  if (Number.isNaN(d.getTime())) return key
  const isToday = key === dayKey(startOfDay(new Date()))
  const label = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  return isToday ? `сегодня · ${label}` : label
}

type ClientRow = {
  userId: string
  client: ReturnType<typeof guestClientFromSubscriptionUser>
  subs: SubRow[]
  active: number
  pending: number
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
        client: guestClientFromSubscriptionUser(s.user),
        subs: [],
        active: 0,
        pending: 0,
        revenue: 0,
      } satisfies ClientRow)
    row.subs.push(s)
    if (s.status === 'ACTIVE') {
      row.active += 1
      row.revenue += Number(s.price) || 0
    }
    if (s.status === 'PENDING') row.pending += 1
    map.set(uid, row)
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.pending - a.pending)
}

function SubscriptionDetailCard({
  sub,
  highlighted,
  onDelete,
  onApprove,
  onReject,
}: {
  sub: SubRow
  highlighted?: boolean
  onDelete: (id: string) => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}) {
  const upcoming = (sub.deliveries ?? [])
    .filter((d) => d.status !== 'CANCELLED' && d.status !== 'DELIVERED')
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 5)

  return (
    <div
      id={`admin-sub-${sub.id}`}
      className={cn(
        'rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4',
        highlighted && 'ring-2 ring-[color:var(--primary)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{sub.name}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                sub.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800'
                  : sub.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-black/5 text-[color:var(--muted)]'
              )}
            >
              {sub.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--muted)]">
            {formatPrice(sub.price)} · {periodLabel(sub.periodDays)} · {sub.personCount} перс.
          </p>
          <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">
            дни: {formatDeliveryDays(sub.deliveryDays)}
            {sub.deliveryTime ? ` · ${sub.deliveryTime}` : ''}
          </p>
        </div>
        {sub.status !== 'PENDING' ? (
          <button
            type="button"
            onClick={() => onDelete(sub.id)}
            className="shrink-0 rounded-full p-2 text-red-600 hover:bg-red-50"
            title="удалить"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {sub.status === 'PENDING' && onApprove && onReject ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onApprove(sub.id)}
            className="flex-1 rounded-full bg-[color:var(--primary)] py-2 text-[12px] font-semibold text-white"
          >
            подтвердить
          </button>
          <button
            type="button"
            onClick={() => onReject(sub.id)}
            className="flex-1 rounded-full border border-[color:var(--stroke)] py-2 text-[12px] font-semibold"
          >
            отклонить
          </button>
        </div>
      ) : null}

      {sub.items.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">рацион</p>
          <ul className="mt-1.5 space-y-1">
            {sub.items.map((it) => (
              <li key={it.id} className="text-[12px] text-[color:var(--text)]">
                {it.quantity > 1 ? `${it.quantity}× ` : ''}
                {it.dish?.name ?? '—'}
                {it.mealSlot ? (
                  <span className="text-[color:var(--muted)]">
                    {' '}
                    · {parseMealSlot(it.mealSlot) ? MEAL_SLOT_LABEL[parseMealSlot(it.mealSlot)!] : it.mealSlot}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            ближайшие доставки
          </p>
          <ul className="mt-1 space-y-1">
            {upcoming.map((d) => {
              const dt = new Date(d.scheduledDate)
              return (
                <li key={d.id} className="flex justify-between text-[12px]">
                  <span>
                    {dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-[color:var(--muted)]">{DELIVERY_STATUS[d.status] ?? d.status}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function AdminSubscriptionClientsPanel({
  initialClientSubscriptions = [],
}: {
  initialClientSubscriptions?: SubRow[]
}) {
  const searchParams = useSearchParams()
  const focusSubscriptionId = searchParams.get('subscriptionId')?.trim() ?? null
  const [tab, setTab] = useState<PanelTab>(focusSubscriptionId ? 'clients' : 'today')
  const [loading, setLoading] = useState(true)
  const [subs, setSubs] = useState<SubRow[]>(initialClientSubscriptions)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightSubId, setHighlightSubId] = useState<string | null>(null)
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => dayKey(startOfDay(new Date())))
  const [search, setSearch] = useState('')
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null)

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
    void load()
  }, [])

  const clients = useMemo(() => groupClients(subs), [subs])
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.client.displayName.toLowerCase().includes(q) ||
        (c.client.contactLabel ?? '').toLowerCase().includes(q.replace(/^@/, '')) ||
        (c.client.telegramId ?? '').includes(q)
    )
  }, [clients, search])

  useEffect(() => {
    if (!focusSubscriptionId || subs.length === 0) return
    const sub = subs.find((s) => s.id === focusSubscriptionId)
    if (!sub) return
    const uid = sub.user?.id ?? `anon-${sub.id}`
    setTab('clients')
    setSelectedId(uid)
    setHighlightSubId(sub.id)
    setExpandedSubId(sub.id)
  }, [focusSubscriptionId, subs])

  useEffect(() => {
    if (!highlightSubId) return
    const el = document.getElementById(`admin-sub-${highlightSubId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [highlightSubId, selectedId, loading, tab])

  useEffect(() => {
    if (focusSubscriptionId) return
    if (!selectedId && filteredClients[0]) setSelectedId(filteredClients[0].userId)
  }, [filteredClients, selectedId, focusSubscriptionId])

  const client = filteredClients.find((c) => c.userId === selectedId) ?? filteredClients[0]
  const activeSubs = useMemo(() => subs.filter((s) => s.status === 'ACTIVE'), [subs])
  const pendingSubs = useMemo(() => subs.filter((s) => s.status === 'PENDING'), [subs])
  const calendar = useMemo(() => buildDeliveryCalendar(activeSubs, 14), [activeSubs])
  const dayPrep = useMemo(() => buildKitchenPrepForDay(activeSubs, selectedDayKey), [activeSubs, selectedDayKey])
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

  const tabOptions = useMemo(
    () => [
      { id: 'today', label: pendingSubs.length ? `сводка · ${pendingSubs.length}` : 'сводка' },
      { id: 'clients', label: `клиенты · ${clients.length}` },
    ],
    [pendingSubs.length, clients.length]
  )

  return (
    <main className="ui-container ui-screen flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden !pb-6 pt-1">
      <header className="mb-3 shrink-0 space-y-2">
        <AdminSubscriptionNav />
        <p className="text-[12px] text-[color:var(--muted)]">
          подписчики · свод на кухню · подтверждения
        </p>
        <PillTabToggle className="w-full" options={tabOptions} value={tab} onChange={(v) => setTab(v as PanelTab)} />
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-24">
        {loading ? (
          <p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>
        ) : subs.length === 0 ? (
          <p className="text-[13px] text-[color:var(--muted)]">Пока нет подписок. Гости оформляют их в разделе «подписка».</p>
        ) : tab === 'today' ? (
          <>
            {pendingSubs.length > 0 ? (
              <section className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-amber-900">
                  ждут подтверждения · {pendingSubs.length}
                </p>
                <div className="space-y-3">
                  {pendingSubs.map((s) => (
                    <div key={s.id} className="rounded-xl border border-amber-200 bg-white p-3">
                      <GuestClientCard
                        client={guestClientFromSubscriptionUser(s.user)}
                        variant="row"
                        meta={`${s.name} · ${formatPrice(s.price)}`}
                        onClick={() => {
                          setTab('clients')
                          setSelectedId(s.user?.id ?? `anon-${s.id}`)
                          setExpandedSubId(s.id)
                          setHighlightSubId(s.id)
                        }}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => reviewSub(s.id, 'approve')}
                          className="flex-1 rounded-full bg-[color:var(--primary)] py-2 text-[12px] font-semibold text-white"
                        >
                          подтвердить
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewSub(s.id, 'reject')}
                          className="flex-1 rounded-full border border-[color:var(--stroke)] py-2 text-[12px] font-semibold"
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

            <section className="rounded-2xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                на кухню · {formatDayTitle(selectedDayKey)}
              </p>
              {dayPrep.deliveryCount === 0 ? (
                <p className="mt-3 text-[13px] text-[color:var(--muted)]">На этот день доставок нет.</p>
              ) : (
                <>
                  <ul className="mt-3 space-y-2">
                    {dayPrep.aggregate.map((line) => (
                      <li
                        key={`${line.mealSlot}:${line.dishName}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3 py-2"
                      >
                        <span className="text-[13px] font-semibold">
                          {line.quantity > 1 ? `${line.quantity}× ` : ''}
                          {line.dishName}
                        </span>
                        {line.mealLabel ? (
                          <span className="shrink-0 text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                            {line.mealLabel}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-[color:var(--muted)]">
                    {dayPrep.deliveryCount}{' '}
                    {dayPrep.deliveryCount === 1 ? 'доставка' : 'доставки'} · свод по рационам подписчиков
                  </p>
                </>
              )}
            </section>

            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                график · 14 дней
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
                      <span className="text-[10px] text-[color:var(--muted)]">{WEEKDAYS_SHORT[d.date.getDay()]}</span>
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

              {dayPrep.deliveries.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                    по клиентам
                  </p>
                  {dayPrep.deliveries.map((row) => {
                    const sub = activeSubs.find((s) => s.id === row.subscriptionId)
                    const clientInfo = guestClientFromSubscriptionUser(sub?.user ?? null, row.clientName)
                    return (
                      <div
                        key={row.deliveryId}
                        className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3"
                      >
                        <GuestClientCard
                          client={clientInfo}
                          variant="row"
                          meta={`${row.subscriptionName}${row.deliveryTime ? ` · ${row.deliveryTime}` : ''}`}
                          badge={DELIVERY_STATUS[row.status] ?? row.status}
                          onClick={() => {
                            if (!sub?.user?.id) return
                            setTab('clients')
                            setSelectedId(sub.user.id)
                            setExpandedSubId(sub.id)
                          }}
                        />
                        <ul className="mt-2 space-y-0.5 border-t border-[color:var(--stroke)] pt-2">
                          {row.dishes.map((d, i) => (
                            <li key={i} className="text-[12px] text-[color:var(--text)]">
                              {d.quantity > 1 ? `${d.quantity}× ` : ''}
                              {d.dishName}
                              {d.mealLabel ? (
                                <span className="text-[color:var(--muted)]"> · {d.mealLabel}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="поиск по имени или @telegram"
              className="input w-full rounded-xl px-3 py-2 text-[13px]"
            />

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {filteredClients.map((c) => (
                <GuestClientCard
                  key={c.userId}
                  client={c.client}
                  variant="tile"
                  selected={c.userId === selectedId}
                  meta={`${c.active} акт.${c.pending ? ` · ${c.pending} ждёт` : ''}`}
                  onClick={() => {
                    setSelectedId(c.userId)
                    setExpandedSubId(null)
                  }}
                />
              ))}
            </div>

            {client ? (
              <section className="space-y-3">
                <GuestClientCard
                  client={client.client}
                  variant="hero"
                  meta={`${client.active} активных · ${formatPrice(client.revenue)} оборот`}
                />

                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  подписки · {client.subs.length}
                </p>
                {client.subs.map((s) => {
                  const open = expandedSubId === s.id
                  return (
                    <div key={s.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedSubId(open ? null : s.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold">{s.name}</p>
                          <p className="text-[12px] text-[color:var(--muted)]">
                            {s.statusLabel} · {formatPrice(s.price)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[12px] text-[color:var(--muted)]">{open ? '▲' : '▼'}</span>
                      </button>
                      {open ? (
                        <div className="mt-2">
                          <SubscriptionDetailCard
                            sub={s}
                            highlighted={highlightSubId === s.id}
                            onDelete={deleteSub}
                            onApprove={s.status === 'PENDING' ? (id) => reviewSub(id, 'approve') : undefined}
                            onReject={s.status === 'PENDING' ? (id) => reviewSub(id, 'reject') : undefined}
                          />
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
