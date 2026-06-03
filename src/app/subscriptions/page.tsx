'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSubscriptionStore } from '@/store/subscription-store'
import Link from 'next/link'
import { useVenue } from '@/lib/venue-context'
import { SUBSCRIPTION_STATUS_TO_FILTER } from '@/lib/constants'
import { SubscriptionListCard } from '@/components/ui/SubscriptionListCard'
import { FilterBar } from '@/components/ui/FilterBar'
import { Chip } from '@/components/ui/Chip'
import { SubscriptionUnavailableCard } from '@/components/subscriptions/SubscriptionUnavailableCard'
import { SubscriptionGuestHub } from '@/features/subscriptions/components/SubscriptionGuestHub'
import { PageHeader } from '@/components/ui/PageHeader'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { defaultSubscriptionConfig, type SubscriptionConfig } from '@/lib/subscription-config'

export type StatusFilterKey = 'all' | 'active' | 'pending' | 'ended' | 'draft'

const STATUS_OPTIONS: { value: StatusFilterKey; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'active', label: 'активная' },
  { value: 'pending', label: 'на подтверждении' },
  { value: 'ended', label: 'закончилась' },
  { value: 'draft', label: 'черновик' },
]

export default function SubscriptionsPage() {
  const pathname = usePathname()
  const { settings, error: venueError, isLoading: venueLoading, refetch: refetchVenue } = useVenue()
  const storeSubscriptions = useSubscriptionStore((state) => state.subscriptions)
  const setSubscriptions = useSubscriptionStore((state) => state.setSubscriptions)
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all')
  const [focusSubscriptionId, setFocusSubscriptionId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [guestConfig, setGuestConfig] = useState<SubscriptionConfig | null>(null)

  const loadSubscriptions = useCallback(async () => {
    setLoadError(null)
    setRefreshing(true)
    try {
      const res = await fetch('/api/subscriptions', {
        cache: 'no-store',
        credentials: 'include',
        headers: { ...telegramInitHeaderRecord() },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !Array.isArray(data?.subscriptions)) {
        if (!res.ok) setLoadError(data?.error || 'Не удалось загрузить список')
        return
      }
      const normalized = data.subscriptions.map((s: any) => ({
        ...s,
        price: Number(s?.price ?? 0),
        startDate: s?.startDate ? new Date(s.startDate) : new Date(),
        nextDelivery: s?.nextDelivery ? new Date(s.nextDelivery) : undefined,
        items: Array.isArray(s?.items)
          ? s.items.map((it: any) => ({
              ...it,
              dish: it?.dish
                ? { ...it.dish, price: Number(it?.dish?.price ?? 0) }
                : it.dish,
            }))
          : [],
      }))
      setSubscriptions(normalized as any)
    } catch {
      setLoadError('Ошибка сети')
    } finally {
      setRefreshing(false)
    }
  }, [setSubscriptions])

  useEffect(() => {
    void loadSubscriptions()
  }, [loadSubscriptions])

  useEffect(() => {
    if (pathname === '/subscriptions') void loadSubscriptions()
  }, [pathname, loadSubscriptions])

  useEffect(() => {
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void loadSubscriptions()
    }
    window.addEventListener('visibilitychange', onVisibility)
    return () => window.removeEventListener('visibilitychange', onVisibility)
  }, [loadSubscriptions])

  useEffect(() => {
    fetch('/api/subscriptions/config', {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...telegramInitHeaderRecord() },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.config) setGuestConfig(data.config)
      })
      .catch(() => {})
  }, [])

  const subscriptions = useMemo(() => storeSubscriptions, [storeSubscriptions])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return subscriptions
    return subscriptions.filter((s) => SUBSCRIPTION_STATUS_TO_FILTER[String(s.status)] === statusFilter)
  }, [subscriptions, statusFilter])

  const hasAny = subscriptions.length > 0

  if (venueError && venueLoading) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader title="подписки" compact className="mb-3" />
        <div className="ui-surface-card p-4 text-center" style={{ borderRadius: 'var(--radius-large)' }}>
          <p className="text-[13px] font-semibold text-red-600">Не удалось загрузить настройки.</p>
          <button type="button" onClick={() => refetchVenue()} className="btn btn-soft mt-4 rounded-full px-4 py-2.5 text-[13px] font-semibold">
            обновить
          </button>
        </div>
      </main>
    )
  }

  if (!settings.subscriptionEnabled) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader title="подписки" compact className="mb-3" />
        <SubscriptionUnavailableCard />
      </main>
    )
  }

  return (
    <main className="ui-container ui-screen">
      <PageHeader title="подписки" subtitle="ваши доставки по расписанию" compact className="mb-4" />

      {loadError && !hasAny && !refreshing ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-center">
          <p className="text-[13px] font-medium text-red-700">{loadError}</p>
          <button type="button" onClick={() => loadSubscriptions()} className="mt-2 text-[12px] font-semibold text-red-600 underline">
            повторить
          </button>
        </div>
      ) : null}

      {hasAny ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-[color:var(--muted)]">
              {subscriptions.length} {subscriptions.length === 1 ? 'подписка' : 'подписок'}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => loadSubscriptions()}
                disabled={refreshing}
                className="btn btn-soft rounded-full px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
              >
                {refreshing ? '…' : 'обновить'}
              </button>
              <Link
                href="/subscriptions/new"
                prefetch={false}
                className="btn btn-primary rounded-full px-4 py-2 text-[13px] font-semibold"
              >
                + новая
              </Link>
            </div>
          </div>

          <FilterBar
            chips={
              <>
                {STATUS_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    accent={statusFilter === opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className="whitespace-nowrap"
                  >
                    {opt.label}
                  </Chip>
                ))}
              </>
            }
          />

          <div className="mt-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="ui-surface-card p-5 text-center">
                <p className="ui-muted text-[13px]">Нет подписок с этим статусом</p>
                <button type="button" onClick={() => setStatusFilter('all')} className="btn btn-soft mt-3 rounded-full px-4 py-2 text-[13px] font-semibold">
                  показать все
                </button>
              </div>
            ) : (
              filtered.map((s) => (
                <SubscriptionListCard
                  key={s.id}
                  subscription={s}
                  isFocused={focusSubscriptionId === s.id}
                  onFocus={() => setFocusSubscriptionId((prev) => (prev === s.id ? null : s.id))}
                />
              ))
            )}
          </div>
        </>
      ) : refreshing ? (
        <p className="py-8 text-center text-[13px] text-[color:var(--muted)]">загрузка…</p>
      ) : (
        <SubscriptionGuestHub config={guestConfig} />
      )}
    </main>
  )
}
