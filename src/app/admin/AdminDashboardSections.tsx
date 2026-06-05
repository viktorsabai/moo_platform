'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AdminSectionOpenLink } from '@/components/admin/AdminSectionOpenLink'
import { AdminSectionCard } from './AdminSectionCard'
import type { DashboardData } from './AdminSectionDashboards'
import {
  VenueDashboard,
  MenuStoreDashboard,
  TeamDashboard,
  OrdersDashboard,
  BannersDashboard,
  ServiceLeadsDashboard,
  SubscriptionLeadsDashboard,
  SubscribersDashboard,
  SubscriptionPlansDashboard,
  NotificationsDashboard,
} from './AdminSectionDashboards'

export type AdminSection = {
  id: string
  group?: 'venue' | 'showcase' | 'operations' | 'subscriptions' | 'requests' | 'analytics'
  title: string
  hint: string
  href: string
  summary: string
  linkLabel?: string
  /** Короткая иконка справа в строке раздела */
  icon?: 'venue' | 'store' | 'team' | 'orders' | 'banners' | 'leads' | 'subscriptions' | 'platform' | 'analytics'
  /** Counter badge (like unread) */
  badgeCount?: number
  badgeLabel?: string
  badgeTone?: 'alert' | 'info'
}

const emptyDashboardData: DashboardData = {
  restaurantId: null,
  restaurantName: '—',
  settings: null,
  isOpenNow: true,
  menuCategoriesCount: 0,
  dishesCount: 0,
  menuItemsCount: 0,
  storeCategoriesCount: 0,
  storeProductsCount: 0,
  bannersCount: 0,
  subscriptionPlansCount: 0,
  subscriptionsCount: 0,
  teamMembers: [],
  stats: { ordersToday: 0, ordersWeek: 0, revenueToday: 0, revenueWeek: 0 },
  activeOrdersCount: 0,
  pendingOrdersCount: 0,
  pendingSubscriptionsCount: 0,
  inboxPendingTotal: 0,
  hotGuestsCount: 0,
  activeCampaignsCount: 0,
  newSubscriptionRequestLeads: 0,
  newServiceLeadsCount: 0,
  visitsCount: 0,
  visitorsCount: 0,
  cartEventsCount: 0,
  newVisitsCount: 0,
  newVisitorsCount: 0,
  recentActivityEvents: [],
}

const LOCAL_TIME_ZONE = 'Asia/Bangkok'

function activityLabel(type: string) {
  switch (type) {
    case 'VIEW_PAGE':
      return 'просмотр'
    case 'CART_WITH_ITEMS':
      return 'корзина'
    case 'START_CHECKOUT':
      return 'чекаут'
    default:
      return type.toLowerCase()
  }
}

function formatLocalTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: LOCAL_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function groupRecentActivity(events: NonNullable<DashboardData['recentActivityEvents']>) {
  const groups = new Map<string, NonNullable<DashboardData['recentActivityEvents']>>()
  for (const event of events) {
    const key = event.userName || event.telegramUsername || event.telegramId || 'гость'
    const list = groups.get(key) ?? []
    list.push(event)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const hasCart = sorted.some((event) => event.type === 'ADD_TO_CART' || event.type === 'CART_WITH_ITEMS' || event.type === 'START_CHECKOUT')
      const hasFavorite = sorted.some((event) => event.type === 'ADD_FAVORITE')
      const status = hasCart ? 'горячий интерес' : hasFavorite ? 'сохранил интерес' : 'смотрит'
      return { name, events: sorted, latest: sorted[0], status }
    })
    .sort((a, b) => new Date(b.latest?.createdAt ?? 0).getTime() - new Date(a.latest?.createdAt ?? 0).getTime())
}

function safeDashboardData(raw: unknown): DashboardData {
  if (raw && typeof raw === 'object' && 'stats' in raw) return raw as DashboardData
  return emptyDashboardData
}

export function AdminDashboardSections({
  sections: rawSections,
  dashboardData: rawData,
}: {
  sections?: AdminSection[] | null
  dashboardData?: DashboardData | null
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const sections = Array.isArray(rawSections) ? rawSections : []
  const dashboardData = safeDashboardData(rawData ?? emptyDashboardData)
  const groups = [
    { id: 'venue', title: 'заведение' },
    { id: 'showcase', title: 'витрина' },
    { id: 'operations', title: 'заказы' },
    { id: 'subscriptions', title: 'подписки' },
    { id: 'requests', title: 'заявки' },
    { id: 'analytics', title: 'статистика' },
  ] as const

  function renderExpandedContent(sectionId: string) {
    try {
      switch (sectionId) {
        case 'venue':
          return <VenueDashboard data={dashboardData} />
        case 'store':
          return <MenuStoreDashboard data={dashboardData} />
        case 'team':
          return <TeamDashboard data={dashboardData} />
        case 'orders':
          return <OrdersDashboard data={dashboardData} />
        case 'banners':
          return <BannersDashboard data={dashboardData} />
        case 'leads':
          return <ServiceLeadsDashboard />
        case 'subscribers':
          return <SubscribersDashboard data={dashboardData} />
        case 'subscription-plans':
          return <SubscriptionPlansDashboard data={dashboardData} />
        case 'subscription-leads':
          return <SubscriptionLeadsDashboard />
        case 'notifications':
          return <NotificationsDashboard />
        case 'visits':
          return (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['новые 24ч', dashboardData.newVisitsCount ?? 0],
                  ['люди', dashboardData.visitorsCount ?? 0],
                  ['корзины', dashboardData.cartEventsCount ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3">
                    <div className="text-[17px] font-extrabold leading-none text-[color:var(--text)]">{value}</div>
                    <div className="mt-1 text-[10px] font-semibold text-[color:var(--muted)]">{label}</div>
                  </div>
                ))}
              </div>
              {(dashboardData.recentActivityEvents ?? []).length > 0 ? (
                <div className="rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-1">
                  {groupRecentActivity(dashboardData.recentActivityEvents ?? []).slice(0, 3).map((guest) => {
                    const isFresh = Date.now() - new Date(guest.latest.createdAt).getTime() < 24 * 60 * 60 * 1000
                    return (
                      <div key={guest.name} className="flex items-center justify-between gap-3 border-b border-[color:var(--stroke)] py-2 last:border-0">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="truncate text-[12px] font-semibold text-[color:var(--text)]">{guest.name}</div>
                            {isFresh ? <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white">new</span> : null}
                          </div>
                          <div className="truncate text-[11px] font-medium text-[color:var(--muted)]">
                            {formatLocalTime(guest.latest.createdAt)} · {guest.status} · {guest.events.length} событий
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-[18px] border border-dashed border-[color:var(--stroke)] px-3 py-3 text-[12px] font-medium text-[color:var(--muted)]">
                  последние гости появятся здесь после новых заходов
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/admin/visits?focus=HOT"
                  prefetch={false}
                  scroll={false}
                  className="flex h-10 items-center justify-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-85"
                >
                  горячие · {dashboardData.hotGuestsCount ?? 0}
                </Link>
                <Link
                  href="/admin/visits"
                  prefetch={false}
                  scroll={false}
                  className="flex h-10 items-center justify-center rounded-full bg-[color:var(--primary)] px-4 text-[13px] font-semibold text-white transition active:opacity-90"
                >
                  все гости
                </Link>
              </div>
              <AdminSectionOpenLink href="/admin/visits" label="Аналитика посещений" />
            </div>
          )
        default:
          return null
      }
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const list = sections.filter((s) => s.group === group.id)
        if (list.length === 0) return null
        return (
          <section key={group.id} className="ui-surface-card overflow-hidden p-0" style={{ borderRadius: 'var(--radius-large)' }}>
            <div className="px-4 py-2">
              <div className="ui-kicker py-2">{group.title}</div>
              <div className="divide-y divide-[color:var(--stroke)] pb-1">
                {list.map((s) => (
                  <AdminSectionCard
                    key={s.id}
                    id={s.id}
                    title={s.title}
                    hint={s.hint}
                    href={s.href}
                    summary={s.summary}
                    linkLabel={s.linkLabel}
                    icon={s.icon}
                    badgeCount={s.badgeCount}
                    badgeLabel={s.badgeLabel}
                    badgeTone={s.badgeTone}
                    isExpanded={expandedId === s.id}
                    onToggle={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                    expandedContent={renderExpandedContent(s.id)}
                  />
                ))}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
