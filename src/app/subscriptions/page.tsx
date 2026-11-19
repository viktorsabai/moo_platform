'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSubscriptionStore } from '@/store/subscription-store'
import Link from 'next/link'
import { useVenue } from '@/lib/venue-context'
import { SUBSCRIPTION_STATUS_FILTERS, SUBSCRIPTION_STATUS_TO_FILTER } from '@/lib/constants'
import { SubscriptionUnavailableCard } from '@/components/subscriptions/SubscriptionUnavailableCard'
import { Screen, Card, Btn, Chip, Empty, Badge, fmtThb } from '@/components/kit'
import { PromoRail, type PromoCard } from '@/features/menu/home-rails'
import { WEEKDAYS } from '@/features/subscriptions/lib/subscription-checkout-utils'
import { loadSubscriptionBuilderDraft, type SubscriptionBuilderDraft } from '@/lib/subscription-builder-draft'
import { totalSubscriptionDiscountPercent } from '@/lib/subscription-offer-labels'
import { getNearestEventLabel, cn } from '@/lib/utils'
import type { Subscription } from '@/types'
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

function SubscriptionsPageContent() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const primary = useMemo(() => pickPrimary(subscriptions), [subscriptions])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return subscriptions
    return subscriptions.filter((s) => SUBSCRIPTION_STATUS_TO_FILTER[String(s.status)] === statusFilter)
  }, [subscriptions, statusFilter])

  if (venueError && venueLoading) {
    return (
      <Screen title="рацион">
        <Card className="text-center">
          <p className="text-[13px] font-semibold text-[color:var(--danger)]">Не удалось загрузить настройки.</p>
          <Btn variant="secondary" className="mt-4" onClick={() => refetchVenue()}>
            обновить
          </Btn>
        </Card>
      </Screen>
    )
  }

  if (venueLoading) {
    return (
      <Screen title="рацион">
        <p className="py-8 text-center text-[13px] text-[color:var(--muted)]">загрузка…</p>
      </Screen>
    )
  }

  if (!settings.subscriptionEnabled) {
    return (
      <Screen title="рацион">
        <SubscriptionUnavailableCard />
      </Screen>
    )
  }

  return (
    <Screen
      title="рацион"
      subtitle={subscriptions.length ? 'ваши подписки на еду' : undefined}
      right={
        subscriptions.length ? (
          <Link href="/subscriptions/new" prefetch={false}>
            <Btn variant="secondary">+ новый</Btn>
          </Link>
        ) : null
      }
    >
      <DraftCard />
      <HubPromos />

      {loadError && subscriptions.length === 0 && !refreshing ? (
        <Card className="mb-3 text-center">
          <p className="text-[13px] font-medium text-[color:var(--danger)]">{loadError}</p>
          <Btn variant="secondary" className="mt-2" onClick={() => loadSubscriptions()}>
            повторить
          </Btn>
        </Card>
      ) : null}

      {refreshing && subscriptions.length === 0 ? (
        <div className="h-48 animate-pulse rounded-[20px] bg-[color:var(--surface)]" aria-busy />
      ) : subscriptions.length === 0 ? (
        <EmptyHub config={guestConfig} />
      ) : (
        <div className="flex flex-col gap-3">
          {primary ? <PrimaryCard s={primary} /> : null}
          {subscriptions.length > 1 ? (
            <>
              {subscriptions.length > 4 ? (
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {STATUS_OPTIONS.map((opt) => (
                    <Chip key={opt.value} active={statusFilter === opt.value} onClick={() => setStatusFilter(opt.value)} className="whitespace-nowrap">
                      {opt.label}
                    </Chip>
                  ))}
                </div>
              ) : (
                <h2 className="mt-1 text-[12.5px] font-semibold text-[color:var(--muted)]">все рационы</h2>
              )}
              {filtered.length ? (
                <Card className="!py-1">
                  {filtered.map((s, i) => (
                    <SubscriptionRow key={s.id} s={s} first={i === 0} focused={focusSubscriptionId === s.id} />
                  ))}
                </Card>
              ) : (
                <Empty title="нет рационов с этим статусом" action={<Btn variant="secondary" onClick={() => setStatusFilter('all')}>показать все</Btn>} />
              )}
            </>
          ) : null}
        </div>
      )}
    </Screen>
  )
}

/* ---------- блоки хаба ---------- */

const JS_WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function statusBadge(status: string) {
  const key = SUBSCRIPTION_STATUS_TO_FILTER[status] ?? 'active'
  if (status === 'PAUSED') return <Badge tone="muted">на паузе</Badge>
  const tone = key === 'active' ? 'ok' : key === 'pending' ? 'warn' : 'muted'
  return <Badge tone={tone}>{SUBSCRIPTION_STATUS_FILTERS[key]}</Badge>
}

function daysLabel(days: number[] | undefined) {
  return [...(days ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => JS_WEEKDAYS[d] ?? d).join(', ')
}

function pickPrimary(list: Subscription[]): Subscription | null {
  for (const status of ['ACTIVE', 'PAUSED', 'PENDING', 'DRAFT']) {
    const found = list.find((s) => s.status === status)
    if (found) return found
  }
  return null
}

function PrimaryCard({ s }: { s: Subscription }) {
  const dishes = Array.from(new Set((s.items ?? []).map((it: any) => it?.dish?.name).filter(Boolean))) as string[]
  return (
    <Link href={`/subscriptions/${s.id}`} prefetch={false} className="block transition active:scale-[0.99]">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-[color:var(--muted)]">
              {s.status === 'PENDING' ? 'ждёт подтверждения ресторана' : s.status === 'DRAFT' ? 'черновик' : 'ближайшая доставка'}
            </div>
            <div className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight text-[color:var(--text)]">
              {s.status === 'ACTIVE' || s.status === 'PAUSED' ? getNearestEventLabel(s.nextDelivery, s.deliveryTime).replace(/^следующая доставка /, '') : s.name}
            </div>
          </div>
          {statusBadge(String(s.status))}
        </div>
        <div className="mt-2 text-[13px] text-[color:var(--muted)]">
          {daysLabel(s.deliveryDays)}
          {s.deliveryTime ? ` · ${s.deliveryTime}` : ''}
        </div>
        {dishes.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {dishes.slice(0, 5).map((n) => (
              <span key={n} className="rounded-full bg-[color:var(--bg)] px-3 py-1.5 text-[13px] text-[color:var(--text)]">{n}</span>
            ))}
            {dishes.length > 5 ? <span className="px-1 py-1.5 text-[13px] text-[color:var(--muted)]">+{dishes.length - 5}</span> : null}
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-[color:var(--stroke)] pt-2.5">
          <span className="text-[17px] font-bold text-[color:var(--text)]">{fmtThb(Number(s.price ?? 0))}</span>
          <span className="text-[13px] font-semibold text-[color:var(--text)]">открыть ›</span>
        </div>
      </Card>
    </Link>
  )
}

function SubscriptionRow({ s, first, focused }: { s: Subscription; first: boolean; focused: boolean }) {
  return (
    <Link
      href={`/subscriptions/${s.id}`}
      prefetch={false}
      className={cn('flex min-h-[60px] items-center gap-3 py-2', !first && 'border-t border-[color:var(--stroke)]', focused && '-mx-2 rounded-[14px] bg-[color:var(--surface)] px-2')}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-[color:var(--text)]">{s.name}</div>
        <div className="truncate text-[12.5px] text-[color:var(--muted)]">
          {daysLabel(s.deliveryDays)} · {fmtThb(Number(s.price ?? 0))}
        </div>
      </div>
      {statusBadge(String(s.status))}
    </Link>
  )
}

function EmptyHub({ config }: { config: SubscriptionConfig | null }) {
  const cfg = config ?? defaultSubscriptionConfig()
  const periods = cfg.availablePeriods?.length ? cfg.availablePeriods : [28]
  const best = cfg.commerce ? Math.max(...periods.map((p) => totalSubscriptionDiscountPercent(cfg.commerce, cfg.periodDiscounts, p))) : 0
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[20px] font-bold leading-tight tracking-tight text-[color:var(--text)]">рацион на неделю</div>
          {best > 0 ? <Badge tone="ok">до −{Math.round(best)}% к меню</Badge> : null}
        </div>
        <p className="mt-1.5 text-[14px] leading-snug text-[color:var(--muted)]">
          выберите дни и блюда один раз — привезём по расписанию, без заказа каждый день. цена всегда ниже меню.
        </p>
        <Link href="/subscriptions/new" prefetch={false} className="mt-3 block">
          <Btn size="lg" full>собрать рацион</Btn>
        </Link>
      </Card>
      <Card className="!py-1">
        {[
          ['1', 'соберите неделю', `от ${cfg.minDaysPerWeek} ${cfg.minDaysPerWeek === 1 ? 'дня' : 'дней'} доставки, блюда на каждый день`],
          ['2', 'ресторан подтвердит', 'ответ придёт в Telegram'],
          ['3', 'едите по расписанию', 'менять блюда можно до доставки'],
        ].map(([n, title, hint], i) => (
          <div key={n} className={cn('flex min-h-[56px] items-center gap-3 py-2', i > 0 && 'border-t border-[color:var(--stroke)]')}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface)] text-[13px] font-bold text-[color:var(--text)]">{n}</span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[color:var(--text)]">{title}</div>
              <div className="text-[12.5px] text-[color:var(--muted)]">{hint}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

/** Незаконченная сборка из конструктора (черновик лежит в браузере) */
function DraftCard() {
  const { restaurantId } = useVenue()
  const [draft, setDraft] = useState<SubscriptionBuilderDraft | null>(null)
  useEffect(() => {
    const refresh = () => setDraft(loadSubscriptionBuilderDraft(restaurantId))
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('ufo:subscription-draft', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('ufo:subscription-draft', refresh)
    }
  }, [restaurantId])
  if (!draft?.lines?.length) return null
  const days = (draft.selectedDays ?? []).map((d) => WEEKDAYS[d]?.toLowerCase()).join(', ')
  return (
    <Link href="/subscriptions/new" prefetch={false} className="mb-3 block transition active:scale-[0.99]">
      <div className="flex items-center gap-3 rounded-[20px] bg-[color:var(--warn-bg)] px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[color:var(--warn)]">продолжить сборку</div>
          <div className="truncate text-[12.5px] text-[color:var(--warn)] opacity-80">
            {draft.lines.length} блюд{days ? ` · ${days}` : ''}{draft.phase === 'checkout' ? ' · почти готово' : ''}
          </div>
        </div>
        <span className="text-[18px] text-[color:var(--warn)]" aria-hidden>›</span>
      </div>
    </Link>
  )
}

/** Акции с размещением «подписки» из админки — та же карусель, что на главной */
function HubPromos() {
  const { settings } = useVenue()
  const [cards, setCards] = useState<PromoCard[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/banners?placement=subscriptions', { credentials: 'include', cache: 'no-store', headers: { ...telegramInitHeaderRecord() } })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data?.banners)) return
        setCards(
          (data.banners as PromoCard[]).filter((b) => {
            const href = String(b.href || '')
            if (href.startsWith('/subscriptions') && !settings.subscriptionEnabled) return false
            if ((href === '/menu' || href.startsWith('/menu?')) && !settings.menuEnabled) return false
            return Boolean(b.id && b.title)
          })
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [settings.menuEnabled, settings.subscriptionEnabled])
  return <PromoRail cards={cards} />
}

export default function SubscriptionsPage() {
  return (
    <Suspense
      fallback={
        <Screen title="рацион">
          <div className="text-[13px] text-[color:var(--muted)]">загрузка…</div>
        </Screen>
      }
    >
      <SubscriptionsPageContent />
    </Suspense>
  )
}
