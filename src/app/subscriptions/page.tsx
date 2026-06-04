'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSubscriptionStore } from '@/store/subscription-store'
import Link from 'next/link'
import { useVenue } from '@/lib/venue-context'
import { SUBSCRIPTION_STATUS_TO_FILTER } from '@/lib/constants'
import { SubscriptionListCard } from '@/components/ui/SubscriptionListCard'
import { FilterBar } from '@/components/ui/FilterBar'
import { Chip } from '@/components/ui/Chip'
import { SubscriptionUnavailableCard } from '@/components/subscriptions/SubscriptionUnavailableCard'
import { SubscriptionHubTabs, type SubscriptionHubTab } from '@/features/subscriptions/components/SubscriptionHubTabs'
import { SubscriptionHubOverview } from '@/features/subscriptions/components/SubscriptionHubOverview'
import { SubscriptionHubDraftBanner } from '@/features/subscriptions/components/SubscriptionHubDraftBanner'
import { PageHeader } from '@/components/ui/PageHeader'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { type SubscriptionConfig } from '@/lib/subscription-config'

export type StatusFilterKey = 'all' | 'active' | 'pending' | 'ended' | 'draft'

const STATUS_OPTIONS: { value: StatusFilterKey; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'active', label: 'активная' },
  { value: 'pending', label: 'на подтверждении' },
  { value: 'ended', label: 'закончилась' },
  { value: 'draft', label: 'черновик' },
]

function SubscriptionsPageContent() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings, error: venueError, isLoading: venueLoading, refetch: refetchVenue } = useVenue()
  const storeSubscriptions = useSubscriptionStore((state) => state.subscriptions)
  const setSubscriptions = useSubscriptionStore((state) => state.setSubscriptions)
  const [hubTab, setHubTab] = useState<SubscriptionHubTab>('overview')
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
    const id = searchParams.get('subscriptionId')?.trim()
    if (id) router.replace(`/subscriptions/${id}`)
  }, [searchParams, router])

  useEffect(() => {
    const id = searchParams.get('focus')?.trim()
    if (id) setFocusSubscriptionId(id)
  }, [searchParams])

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

  if (venueError && venueLoading) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader title="подписка" compact className="mb-3" />
        <div className="ui-surface-card p-4 text-center" style={{ borderRadius: 'var(--radius-large)' }}>
          <p className="text-[13px] font-semibold text-red-600">Не удалось загрузить настройки.</p>
          <button type="button" onClick={() => refetchVenue()} className="btn btn-soft mt-4 rounded-full px-4 py-2.5 text-[13px] font-semibold">
            обновить
          </button>
        </div>
      </main>
    )
  }

  if (venueLoading) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader title="подписка" compact className="mb-3" />
        <p className="py-8 text-center text-[13px] text-[color:var(--muted)]">загрузка…</p>
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
      <div className="mb-3 flex items-start justify-between gap-3">
        <PageHeader title="подписка" compact className="min-w-0 flex-1" />
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => loadSubscriptions()}
            disabled={refreshing}
            className="btn btn-soft rounded-full px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
            aria-label="обновить"
          >
            {refreshing ? '…' : '↻'}
          </button>
          <Link
            href="/subscriptions/new"
            prefetch={false}
            className="btn btn-primary rounded-full px-3.5 py-2 text-[12px] font-bold"
          >
            + новая
          </Link>
        </div>
      </div>

      <SubscriptionHubTabs tab={hubTab} onTab={setHubTab} listCount={subscriptions.length} />

      {hubTab === 'list' ? <SubscriptionHubDraftBanner /> : null}

      {loadError && subscriptions.length === 0 && !refreshing ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-center">
          <p className="text-[13px] font-medium text-red-700">{loadError}</p>
          <button type="button" onClick={() => loadSubscriptions()} className="mt-2 text-[12px] font-semibold text-red-600 underline">
            повторить
          </button>
        </div>
      ) : null}

      {hubTab === 'overview' ? (
        <SubscriptionHubOverview subscriptions={subscriptions} config={guestConfig} loading={refreshing} />
      ) : (
        <>
          {subscriptions.length > 0 ? (
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
          ) : null}

          <div className="mt-4 space-y-3">
            {refreshing && subscriptions.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[color:var(--muted)]">загрузка…</p>
            ) : filtered.length === 0 ? (
              <div className="ui-surface-card p-5 text-center">
                <p className="ui-muted text-[13px]">
                  {subscriptions.length === 0 ? 'Подписок пока нет' : 'Нет подписок с этим статусом'}
                </p>
                {subscriptions.length === 0 ? (
                  <Link
                    href="/subscriptions/new"
                    prefetch={false}
                    className="btn btn-primary mt-4 inline-flex rounded-full px-5 py-2.5 text-[13px] font-bold"
                  >
                    собрать подписку
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="btn btn-soft mt-3 rounded-full px-4 py-2 text-[13px] font-semibold"
                  >
                    показать все
                  </button>
                )}
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
      )}
    </main>
  )
}

export default function SubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <main className="ui-container ui-screen">
          <div className="ui-muted p-4 text-[13px]">загрузка…</div>
        </main>
      }
    >
      <SubscriptionsPageContent />
    </Suspense>
  )
}
