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
import { PageHeader } from '@/components/ui/PageHeader'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'

export type StatusFilterKey = 'all' | 'active' | 'ended' | 'draft'

const STATUS_OPTIONS: { value: StatusFilterKey; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'active', label: 'активная' },
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
  const [refreshing, setRefreshing] = useState(false)

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
    loadSubscriptions()
  }, [loadSubscriptions])

  useEffect(() => {
    if (pathname === '/subscriptions') loadSubscriptions()
  }, [pathname, loadSubscriptions])

  useEffect(() => {
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') loadSubscriptions()
    }
    window.addEventListener('visibilitychange', onVisibility)
    return () => window.removeEventListener('visibilitychange', onVisibility)
  }, [loadSubscriptions])

  const subscriptions = useMemo(() => storeSubscriptions, [storeSubscriptions])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return subscriptions
    return subscriptions.filter((s) => SUBSCRIPTION_STATUS_TO_FILTER[String(s.status)] === statusFilter)
  }, [subscriptions, statusFilter])

  if (venueError && venueLoading) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader title="подписка" compact className="mb-3" />
        <div className="ui-surface-card p-4 text-center" style={{ borderRadius: 'var(--radius-large)' }}>
          <p className="text-[13px] font-semibold text-red-600">Не удалось загрузить настройки.</p>
          <p className="ui-muted mt-1 text-[13px]">Проверьте соединение и обновите страницу.</p>
          <button
            type="button"
            onClick={() => refetchVenue()}
            className="btn btn-soft mt-4 rounded-full px-4 py-2.5 text-[13px] font-semibold"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            обновить
          </button>
        </div>
      </main>
    )
  }

  if (!settings.subscriptionEnabled) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader title="подписка" compact className="mb-3" />
        <SubscriptionUnavailableCard />
      </main>
    )
  }

  return (
    <main className="ui-container ui-screen">
      {loadError && subscriptions.length === 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-center">
          <p className="text-[13px] font-medium text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => loadSubscriptions()}
            className="mt-2 text-[12px] font-semibold text-red-600 underline"
          >
            повторить
          </button>
        </div>
      )}
      {/* Dashboard: title, create, status filter */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="ui-h1">мои подписки</h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => loadSubscriptions()}
              disabled={refreshing}
              className="btn btn-soft inline-flex items-center justify-center rounded-full px-3 py-2.5 text-[13px] font-semibold transition active:scale-[0.98]"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {refreshing ? '…' : 'обновить'}
            </button>
            <Link
              href="/subscriptions/new"
              prefetch={false}
              scroll={false}
              className="btn btn-primary inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2.5 text-[14px] font-semibold transition active:scale-[0.98]"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              создать подписку
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
      </div>

      {/* List: name, status, nearest event only; card → details */}
      <div className="mt-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="ui-surface-card p-5 text-center" style={{ borderRadius: 'var(--radius-large)' }}>
            <p className="ui-muted text-[13px]">
              {subscriptions.length === 0
                ? 'Пока нет подписок'
                : statusFilter === 'all'
                  ? 'Нет подписок'
                  : 'Нет подписок с этим статусом'}
            </p>
            <Link
              href="/subscriptions/new"
              prefetch={false}
              scroll={false}
              className="btn btn-soft mt-4 inline-flex rounded-full px-4 py-2.5 text-[14px] font-semibold"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              создать подписку
            </Link>
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
    </main>
  )
}
