'use client'

import Link from 'next/link'
import type { Subscription } from '@/types'
import { cn, formatPrice } from '@/lib/utils'
import { getNearestEventLabel } from '@/lib/utils'
import { SUBSCRIPTION_STATUS_FILTERS, SUBSCRIPTION_STATUS_TO_FILTER } from '@/lib/constants'
import type { SubscriptionConfig } from '@/lib/subscription-config'
import { periodLabel, defaultSubscriptionConfig } from '@/lib/subscription-config'
import { formatGuestPeriodBadge } from '@/lib/subscription-offer-labels'
import { SubscriptionHubBanners } from '@/features/subscriptions/components/SubscriptionHubBanners'

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const

type Props = {
  subscriptions: Subscription[]
  config?: SubscriptionConfig | null
  loading?: boolean
}

function pickPrimary(subscriptions: Subscription[]): Subscription | null {
  const order = ['ACTIVE', 'PAUSED', 'PENDING', 'DRAFT'] as const
  for (const status of order) {
    const found = subscriptions.find((s) => s.status === status)
    if (found) return found
  }
  return subscriptions[0] ?? null
}

function countByFilter(subscriptions: Subscription[], key: 'active' | 'pending' | 'draft') {
  return subscriptions.filter((s) => SUBSCRIPTION_STATUS_TO_FILTER[String(s.status)] === key).length
}

export function SubscriptionHubOverview({ subscriptions, config, loading }: Props) {
  const cfg = config ?? defaultSubscriptionConfig()
  const primary = pickPrimary(subscriptions)
  const activeCount = countByFilter(subscriptions, 'active')
  const pendingCount = countByFilter(subscriptions, 'pending')
  const draftCount = countByFilter(subscriptions, 'draft')
  const offerBadge = formatGuestPeriodBadge(cfg.commerce, cfg.periodDiscounts, cfg.defaultPeriodDays ?? 28)

  if (loading && subscriptions.length === 0) {
    return (
      <div className="space-y-3">
        <SubscriptionHubBanners />
        <div className="h-36 animate-pulse rounded-[var(--radius-large)] bg-[color:var(--stroke)]/40" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[var(--radius-medium)] bg-[color:var(--stroke)]/30" />
          ))}
        </div>
      </div>
    )
  }

  if (!primary) {
    return (
      <div className="space-y-4">
        <SubscriptionHubBanners />
        <section className="rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">статус</p>
          <p className="mt-1 text-[17px] font-extrabold leading-tight">нет подписки</p>
          <p className="mt-2 text-[13px] leading-snug text-[color:var(--muted)]">
            Соберите рацион на ваши дни — доставка по расписанию, без заказа каждый раз.
          </p>
          {offerBadge ? (
            <p className="mt-3 text-[12px] font-semibold text-[color:var(--text)]">выгода {offerBadge} на длинный период</p>
          ) : null}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <StatTile label="ближайшая доставка" value="—" />
          <StatTile label="дней в неделю" value={`от ${cfg.minDaysPerWeek}`} />
        </div>

        <Link
          href="/subscriptions/new"
          prefetch={false}
          className="btn btn-primary flex h-12 w-full items-center justify-center rounded-full text-[15px] font-bold"
          style={{ borderRadius: 'var(--radius-pill)' }}
        >
          собрать подписку
        </Link>
      </div>
    )
  }

  const filterKey = SUBSCRIPTION_STATUS_TO_FILTER[String(primary.status)] ?? 'active'
  const statusLabel = SUBSCRIPTION_STATUS_FILTERS[filterKey]
  const nearest = getNearestEventLabel(primary.nextDelivery, primary.deliveryTime)
  const periodDays = (primary as Subscription & { periodDays?: number }).periodDays
  const personCount = (primary as Subscription & { personCount?: number }).personCount ?? 1

  return (
    <div className="space-y-4">
      <SubscriptionHubBanners />
      <section className="rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">ближайшая доставка</p>
            <p className="mt-1 text-[18px] font-extrabold leading-tight capitalize">{nearest}</p>
            <p className="mt-2 truncate text-[14px] font-semibold">{primary.name}</p>
          </div>
          <span className="shrink-0 rounded-full border border-[color:var(--stroke)] px-2.5 py-1 text-[11px] font-bold">
            {statusLabel}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(primary.deliveryDays ?? []).map((day) => (
            <span
              key={day}
              className="rounded-full border border-[color:var(--stroke)] px-2 py-0.5 text-[11px] font-semibold"
            >
              {WEEKDAYS[day] ?? day}
            </span>
          ))}
          {primary.deliveryTime ? (
            <span className="rounded-full bg-[color:var(--text)]/5 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--muted)]">
              {primary.deliveryTime}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            href={`/subscriptions/${primary.id}`}
            prefetch={false}
            className="btn btn-primary flex-1 rounded-full py-2.5 text-center text-[13px] font-bold"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            открыть
          </Link>
          <Link
            href="/subscriptions/new"
            prefetch={false}
            className="btn btn-soft rounded-full px-4 py-2.5 text-[13px] font-semibold"
          >
            + ещё
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="активные" value={String(activeCount)} highlight={activeCount > 0} />
        <StatTile label="ожидают" value={String(pendingCount)} highlight={pendingCount > 0} />
        <StatTile label="черновики" value={String(draftCount)} />
      </div>

      <section className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-3">
        <ul className="space-y-2 text-[13px]">
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">период</span>
            <span className="font-semibold tabular-nums">
              {periodDays ? periodLabel(periodDays) : '—'}
            </span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">персоны</span>
            <span className="font-semibold tabular-nums">{personCount}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">итого за период</span>
            <span className="font-extrabold tabular-nums">{formatPrice(primary.price)}</span>
          </li>
          <li className="flex justify-between gap-3">
            <span className="text-[color:var(--muted)]">всего подписок</span>
            <span className="font-semibold tabular-nums">{subscriptions.length}</span>
          </li>
        </ul>
      </section>

      {subscriptions.length > 1 ? (
        <p className="text-center text-[12px] text-[color:var(--muted)]">
          остальные — во вкладке{' '}
          <span className="font-bold text-[color:var(--text)]">мои</span>
        </p>
      ) : null}
    </div>
  )
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-medium)] border border-[color:var(--stroke)] px-2.5 py-2.5',
        highlight && 'border-[color:var(--text)]/25 bg-[color:var(--text)]/[0.03]'
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-extrabold tabular-nums leading-tight">{value}</p>
    </div>
  )
}
