'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'
import { IconPencil } from '@/components/ui/icons'
import { useVenue } from '@/lib/venue-context'

export type DashboardData = {
  restaurantId?: string | null
  restaurantName: string
  settings: {
    openTime: string
    closeTime: string
    deliveryFee: number
    freeDeliveryFrom: number
    menuEnabled: boolean
    storeEnabled: boolean
    subscriptionEnabled: boolean
    isOpenOverride?: boolean | null
  } | null
  isOpenNow?: boolean
  menuCategoriesCount: number
  dishesCount: number
  menuItemsCount?: number
  storeCategoriesCount: number
  storeProductsCount: number
  bannersCount: number
  subscriptionPlansCount: number
  subscriptionsCount: number
  teamMembers: { id: string; role: string; name: string }[]
  stats: {
    ordersToday: number
    ordersWeek: number
    revenueToday: number
    revenueWeek: number
  }
  activeOrdersCount?: number
  pendingOrdersCount?: number
  pendingSubscriptionsCount?: number
  inboxPendingTotal?: number
  hotGuestsCount?: number
  activeCampaignsCount?: number
  newSubscriptionRequestLeads?: number
  newServiceLeadsCount?: number
  visitsCount?: number
  newVisitsCount?: number
  newVisitorsCount?: number
  visitorsCount?: number
  cartEventsCount?: number
  recentActivityEvents?: {
    id: string
    type: string
    path?: string | null
    userName?: string | null
    telegramUsername?: string | null
    telegramId?: string | null
    createdAt: string
  }[]
}

type LeadRow = {
  id: string
  status: 'NEW' | 'IN_PROGRESS' | 'DONE'
}

type BannerRow = {
  id: string
  isActive: boolean
}

const rowClass = 'flex items-center justify-between gap-3 py-2 border-b border-[color:var(--stroke)] last:border-0'
const labelClass = 'ui-muted text-[12px]'
const valueClass = 'ui-body text-[13px] font-semibold tabular-nums'

function QuickPrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90 disabled:opacity-55"
    >
      {children}
    </button>
  )
}

function QuickGhostButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85 disabled:opacity-55"
    >
      {children}
    </button>
  )
}

export function VenueDashboard({ data }: { data: DashboardData }) {
  const { name: venueName, refetch: refetchVenue } = useVenue()
  const s = data.settings
  const [nameEditing, setNameEditing] = useState(false)
  const [nameValue, setNameValue] = useState(data.restaurantName)
  const [nameSaving, setNameSaving] = useState(false)
  const [override, setOverride] = useState<boolean | null>(s?.isOpenOverride ?? null)
  const [pauseSaving, setPauseSaving] = useState(false)
  const [paymentEnabledCount, setPaymentEnabledCount] = useState<number | null>(null)
  const displayName = venueName ?? data.restaurantName
  const paused = override === false
  const acceptingLabel = paused ? 'приём на паузе' : data.isOpenNow ? 'принимаем заказы' : 'вне часов работы'

  useEffect(() => {
    if (!nameEditing) setNameValue(displayName)
  }, [displayName, nameEditing])

  useEffect(() => {
    setOverride(s?.isOpenOverride ?? null)
  }, [s?.isOpenOverride])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' })
        const json = await res.json().catch(() => null)
        if (cancelled || !res.ok || !json?.ok) return
        const rows = Array.isArray(json.settings?.paymentMethodsJson)
          ? json.settings.paymentMethodsJson
          : []
        const n = rows.filter((r: { enabled?: boolean }) => Boolean(r?.enabled)).length
        setPaymentEnabledCount(n)
      } catch {
        if (!cancelled) setPaymentEnabledCount(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleAccepting() {
    const next = paused ? null : false
    setPauseSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isOpenOverride: next }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) {
        toast.error(d?.error || 'Не удалось обновить режим')
        return
      }
      setOverride(next)
      void refetchVenue()
      toast.success(next === false ? 'Прием заказов на паузе' : 'Прием заказов возобновлен')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setPauseSaving(false)
    }
  }

  async function saveName() {
    if (!data.restaurantId || !nameValue.trim()) return
    setNameSaving(true)
    try {
      const res = await fetch(`/api/restaurant/${encodeURIComponent(data.restaurantId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
        credentials: 'include',
      })
      const d = await res.json().catch(() => null)
      if (res.ok && d?.ok) {
        setNameValue(nameValue.trim())
        setNameEditing(false)
        void refetchVenue()
        toast.success('Название сохранено')
      } else {
        toast.error(d?.error || 'Не удалось сохранить')
      }
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setNameSaving(false)
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>заведение</span>
        {nameEditing ? (
          <div className="flex min-w-0 items-center gap-2">
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="input input--pill min-w-0 flex-1 text-[13px]"
              placeholder="Название"
              autoFocus
            />
            <button
              type="button"
              onClick={saveName}
              disabled={nameSaving}
              className="shrink-0 rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {nameSaving ? '…' : 'ок'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNameEditing(false)
                setNameValue(displayName)
              }}
              className="shrink-0 text-[12px] font-medium text-[color:var(--muted)]"
            >
              отмена
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <span className={valueClass}>{displayName}</span>
            {data.restaurantId && (
              <button
                type="button"
                onClick={() => setNameEditing(true)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--primary)] transition hover:bg-black/5 active:opacity-80"
                aria-label="изменить название"
              >
                <IconPencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      {s && (
        <>
          <div className={rowClass}>
            <span className={labelClass}>часы</span>
            <Link href="/admin/venue" prefetch={false} className="flex items-center gap-1.5">
              <span className={valueClass}>
                {s.openTime}–{s.closeTime}
              </span>
              <IconPencil className="h-3.5 w-3.5 text-[color:var(--muted)]" aria-hidden />
            </Link>
          </div>
          <div className={rowClass}>
            <span className={labelClass}>режим</span>
            <span className={valueClass}>{acceptingLabel}</span>
          </div>
          <div className={rowClass}>
            <span className={labelClass}>доставка</span>
            <span className={valueClass}>
              {formatPrice(s.deliveryFee)} · бесплатно от {formatPrice(s.freeDeliveryFrom)}
            </span>
          </div>
          <div className={rowClass}>
            <span className={labelClass}>оплата</span>
            <span className={valueClass}>
              {paymentEnabledCount == null ? '…' : `${paymentEnabledCount} способов включено`}
            </span>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <QuickPrimaryButton onClick={toggleAccepting} disabled={pauseSaving}>
          {pauseSaving ? '…' : paused ? 'возобновить прием' : 'пауза приема'}
        </QuickPrimaryButton>
        <Link
          href="/admin/venue?section=delivery"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          доставка
        </Link>
        <Link
          href="/admin/venue?section=payments"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          оплата
        </Link>
        <Link
          href="/admin/venue"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
        >
          все настройки
        </Link>
      </div>
    </div>
  )
}

export function MenuStoreDashboard({ data }: { data: DashboardData }) {
  const { refetch: refetchVenue } = useVenue()
  const s = data.settings
  const [menuEnabled, setMenuEnabled] = useState(Boolean(s?.menuEnabled))
  const [storeEnabled, setStoreEnabled] = useState(Boolean(s?.storeEnabled ?? true))
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(Boolean(s?.subscriptionEnabled))
  const [saving, setSaving] = useState<null | 'menu' | 'store' | 'subscription'>(null)

  async function toggleCatalog(key: 'menuEnabled' | 'storeEnabled' | 'subscriptionEnabled', next: boolean) {
    setSaving(key === 'menuEnabled' ? 'menu' : key === 'storeEnabled' ? 'store' : 'subscription')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: next }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) {
        toast.error(d?.error || 'Не удалось сохранить')
        return
      }
      if (key === 'menuEnabled') setMenuEnabled(next)
      if (key === 'storeEnabled') setStoreEnabled(next)
      if (key === 'subscriptionEnabled') setSubscriptionEnabled(next)
      void refetchVenue()
      toast.success(next ? 'Раздел включен' : 'Раздел скрыт')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/[0.04] p-3" style={{ borderRadius: 'var(--radius-medium)' }}>
          <div className={labelClass}>готовые блюда</div>
          <div className="mt-0.5 text-[15px] font-bold tabular-nums">{data.dishesCount}</div>
          <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">{data.menuCategoriesCount} кат.</div>
        </div>
        <div className="rounded-xl bg-black/[0.04] p-3" style={{ borderRadius: 'var(--radius-medium)' }}>
          <div className={labelClass}>магазин</div>
          <div className="mt-0.5 text-[15px] font-bold tabular-nums">{data.storeProductsCount}</div>
          <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">{data.storeCategoriesCount} кат.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QuickGhostButton
          onClick={() => toggleCatalog('menuEnabled', !menuEnabled)}
          disabled={saving !== null}
        >
          {saving === 'menu' ? '…' : menuEnabled ? 'пауза меню' : 'включить меню'}
        </QuickGhostButton>
        <QuickGhostButton
          onClick={() => toggleCatalog('storeEnabled', !storeEnabled)}
          disabled={saving !== null}
        >
          {saving === 'store' ? '…' : storeEnabled ? 'пауза магазин' : 'включить магазин'}
        </QuickGhostButton>
        <QuickGhostButton
          onClick={() => toggleCatalog('subscriptionEnabled', !subscriptionEnabled)}
          disabled={saving !== null}
        >
          {saving === 'subscription' ? '…' : subscriptionEnabled ? 'пауза подписки' : 'включить подписки'}
        </QuickGhostButton>
        <Link
          href="/admin/subscriptions/clients"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          подписчики
        </Link>
      </div>
      <Link
        href="/admin/store"
        prefetch={false}
        scroll={false}
        className="mt-2 flex h-10 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-5 text-[14px] font-semibold text-white transition active:opacity-90"
      >
        Перейти к деталям
      </Link>
    </div>
  )
}

export function TeamDashboard({ data }: { data: DashboardData }) {
  const roleLabel: Record<string, string> = { OWNER: 'владелец', ADMIN: 'админ', STAFF: 'сотрудник' }
  const members = data.teamMembers ?? []
  const admins = members.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN').length

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>всего</span>
        <span className={valueClass}>{members.length} чел.</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>управляющих</span>
        <span className={valueClass}>{admins}</span>
      </div>
      <ul className="max-h-28 space-y-1 overflow-y-auto">
        {members.slice(0, 5).map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-1 text-[13px]">
            <span className="truncate font-medium text-[color:var(--text)]">{m.name}</span>
            <span
              className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-medium text-[color:var(--muted)]"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {roleLabel[m.role] ?? m.role}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/admin/team"
        prefetch={false}
        scroll={false}
        className="flex h-10 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
      >
        управление командой
      </Link>
    </div>
  )
}

export function OrdersDashboard({ data }: { data: DashboardData }) {
  const stats = data.stats ?? { ordersToday: 0, ordersWeek: 0, revenueToday: 0, revenueWeek: 0 }
  const { ordersToday, ordersWeek, revenueToday, revenueWeek } = stats
  const todayPct = ordersWeek > 0 ? Math.min(100, (ordersToday / ordersWeek) * 100) : 0
  const pendingNew = data.pendingOrdersCount ?? 0
  const active = data.activeOrdersCount ?? 0

  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/[0.04] p-3" style={{ borderRadius: 'var(--radius-medium)' }}>
          <div className={labelClass}>сегодня</div>
          <div className="mt-0.5 text-[15px] font-bold tabular-nums">{ordersToday}</div>
          <div className="mt-0.5 text-[12px] font-semibold text-[color:var(--muted)]">{formatPrice(revenueToday)}</div>
        </div>
        <div className="rounded-xl bg-black/[0.04] p-3" style={{ borderRadius: 'var(--radius-medium)' }}>
          <div className={labelClass}>за неделю</div>
          <div className="mt-0.5 text-[15px] font-bold tabular-nums">{ordersWeek}</div>
          <div className="mt-0.5 text-[12px] font-semibold text-[color:var(--muted)]">{formatPrice(revenueWeek)}</div>
        </div>
      </div>
      <div>
        <div className="h-2 rounded-full bg-[color:var(--accent)]/30" style={{ borderRadius: 'var(--radius-pill)' }}>
          <div
            className="h-full rounded-full bg-[color:var(--accent)] transition-[width] duration-300"
            style={{ borderRadius: 'var(--radius-pill)', width: `${todayPct}%` }}
          />
        </div>
        <div className="ui-muted mt-1 text-[10px]">сегодня / неделя</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/admin/orders"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
        >
          {pendingNew > 0 ? `новые: ${pendingNew}` : 'все заказы'}
        </Link>
        <Link
          href="/admin/orders"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          {active > 0 ? `в работе: ${active}` : 'очередь'}
        </Link>
      </div>
    </div>
  )
}

export function BannersDashboard({ data }: { data: DashboardData }) {
  const [busy, setBusy] = useState(false)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const campaignsActive = data.activeCampaignsCount ?? 0

  async function toggleAllBanners() {
    setBusy(true)
    try {
      const listRes = await fetch('/api/admin/banners', { cache: 'no-store', credentials: 'include' })
      const listData = await listRes.json().catch(() => null)
      const rows = Array.isArray(listData?.banners) ? (listData.banners as BannerRow[]) : []
      if (!listRes.ok || !listData?.ok || rows.length === 0) {
        toast.error(rows.length === 0 ? 'Нет баннеров для переключения' : 'Не удалось загрузить баннеры')
        return
      }
      const allActive = rows.every((b) => Boolean(b.isActive))
      const next = !allActive
      const targets = rows.filter((b) => Boolean(b.isActive) !== next)
      if (!targets.length) {
        toast('Состояние уже актуально')
        return
      }
      const results = await Promise.all(
        targets.map((b) =>
          fetch('/api/admin/banners', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: b.id, isActive: next }),
          })
        )
      )
      if (results.some((r) => !r.ok)) {
        toast.error('Часть баннеров не обновилась')
      } else {
        const nextCount = next ? rows.length : 0
        setActiveCount(nextCount)
        toast.success(next ? 'Баннеры включены' : 'Баннеры скрыты')
      }
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  const displayCount = activeCount ?? data.bannersCount

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>баннеров на главной</span>
        <span className={valueClass}>{displayCount}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>активных акций</span>
        <span className={valueClass}>{campaignsActive}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QuickGhostButton onClick={toggleAllBanners} disabled={busy}>
          {busy ? '…' : displayCount > 0 ? 'скрыть все' : 'включить баннеры'}
        </QuickGhostButton>
        <Link
          href="/admin/banners"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
        >
          баннеры и акции
        </Link>
      </div>
    </div>
  )
}

export function SubscriptionLeadsDashboard() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [leads, setLeads] = useState<LeadRow[]>([])

  async function loadLeads() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/subscription-leads', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !Array.isArray(data?.leads)) {
        setLeads([])
        return
      }
      setLeads(data.leads)
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeads()
  }, [])

  const stats = useMemo(() => {
    let newCount = 0
    let inProgress = 0
    for (const l of leads) {
      if (l.status === 'NEW') newCount += 1
      if (l.status === 'IN_PROGRESS') inProgress += 1
    }
    return { newCount, inProgress }
  }, [leads])

  async function takeNewestLead() {
    const lead = leads.find((l) => l.status === 'NEW')
    if (!lead) {
      toast('Новых лидов нет')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/subscription-leads', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: lead.id, status: 'IN_PROGRESS' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось обновить лид')
        return
      }
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'IN_PROGRESS' } : l)))
      toast.success('Лид взят в работу')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>новые</span>
        <span className={valueClass}>{loading ? '…' : stats.newCount}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>в работе</span>
        <span className={valueClass}>{loading ? '…' : stats.inProgress}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QuickPrimaryButton onClick={takeNewestLead} disabled={busy || loading}>
          {busy ? '…' : 'взять лид'}
        </QuickPrimaryButton>
        <Link
          href="/admin/subscription-leads"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          детали
        </Link>
      </div>
    </div>
  )
}

export function ServiceLeadsDashboard() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [leads, setLeads] = useState<LeadRow[]>([])

  async function loadLeads() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/leads', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !Array.isArray(data?.leads)) {
        setLeads([])
        return
      }
      setLeads(data.leads)
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeads()
  }, [])

  const stats = useMemo(() => {
    let newCount = 0
    let inProgress = 0
    for (const l of leads) {
      if (l.status === 'NEW') newCount += 1
      if (l.status === 'IN_PROGRESS') inProgress += 1
    }
    return { newCount, inProgress }
  }, [leads])

  async function takeNewestLead() {
    const lead = leads.find((l) => l.status === 'NEW')
    if (!lead) {
      toast('Новых заявок нет')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: lead.id, status: 'IN_PROGRESS' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не удалось обновить заявку')
        return
      }
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: 'IN_PROGRESS' } : l)))
      toast.success('Заявка взята в работу')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>новые</span>
        <span className={valueClass}>{loading ? '…' : stats.newCount}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>в работе</span>
        <span className={valueClass}>{loading ? '…' : stats.inProgress}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QuickPrimaryButton onClick={takeNewestLead} disabled={busy || loading}>
          {busy ? '…' : 'взять заявку'}
        </QuickPrimaryButton>
        <Link
          href="/admin/leads"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          детали
        </Link>
      </div>
    </div>
  )
}

export function SubscribersDashboard({ data }: { data: DashboardData }) {
  const pending = data.pendingSubscriptionsCount ?? 0
  const total = data.subscriptionsCount ?? 0

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>на подтверждении</span>
        <span className={valueClass}>{pending}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>всего подписок</span>
        <span className={valueClass}>{total}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/admin/subscriptions/clients"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
        >
          {pending > 0 ? 'подтвердить' : 'подписчики'}
        </Link>
        <Link
          href="/admin/subscriptions/clients"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          сводка на кухню
        </Link>
      </div>
    </div>
  )
}

export function SubscriptionPlansDashboard({ data }: { data: DashboardData }) {
  const enabled = Boolean(data.settings?.subscriptionEnabled)

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>шаблонов планов</span>
        <span className={valueClass}>{data.subscriptionPlansCount}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>раздел в приложении</span>
        <span className={valueClass}>{enabled ? 'включен' : 'выключен'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/admin/subscriptions"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
        >
          конструктор планов
        </Link>
        <Link
          href="/admin/store"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          меню для рационов
        </Link>
      </div>
    </div>
  )
}

type NotificationSetup = {
  botConnected: boolean
  botUsername: string | null
  opsRecipientCount: number
  teamWithTelegram: number
  teamTotal: number
}

export function NotificationsDashboard() {
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState<NotificationSetup | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/notifications/registry', { cache: 'no-store', credentials: 'include' })
        const data = await res.json().catch(() => null)
        if (!cancelled && res.ok && data?.ok && data.setup) {
          setSetup(data.setup as NotificationSetup)
        } else if (!cancelled) {
          setSetup(null)
        }
      } catch {
        if (!cancelled) setSetup(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-3 pt-1">
      <div className={rowClass}>
        <span className={labelClass}>бот</span>
        <span className={valueClass}>
          {loading ? '…' : setup?.botConnected ? setup.botUsername ? `@${setup.botUsername}` : 'подключен' : 'не настроен'}
        </span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>получатели ops</span>
        <span className={valueClass}>
          {loading ? '…' : `${setup?.opsRecipientCount ?? 0} · tg у ${setup?.teamWithTelegram ?? 0}/${setup?.teamTotal ?? 0}`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/admin/qr"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
        >
          бот и QR
        </Link>
        <Link
          href="/admin/notifications"
          prefetch={false}
          scroll={false}
          className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          каталог событий
        </Link>
        <Link
          href="/admin/team"
          prefetch={false}
          scroll={false}
          className="col-span-2 flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
        >
          команда и Telegram
        </Link>
      </div>
    </div>
  )
}
