'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscriptionStore } from '@/store/subscription-store'
import { formatPrice, getNearestEventLabel } from '@/lib/utils'
import { SUBSCRIPTION_STATUSES } from '@/lib/constants'
import { canEditSubscription, getDeliveryCutoff } from '@/lib/subscription-rules'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { Screen, Card, Btn, Badge, Empty } from '@/components/kit'

function itemLabel(it: any) {
  const qty = Math.max(1, Number(it?.quantity ?? 1))
  return `${it?.dish?.name ?? 'блюдо'}${qty > 1 ? ` ×${qty}` : ''}`
}

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]
const DAY_LOWER = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return one
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few
  return many
}

function periodShort(days?: number) {
  if (!days) return ''
  if (days === 7) return 'неделя'
  if (days === 14) return '2 недели'
  if (days === 28) return '4 недели'
  return `${days} дн.`
}

/** Группировка items по dayOfWeek. dayOfWeek null = для всех дней (показываем как "одна доставка"). */
function groupItemsByDay(items: Array<{ dayOfWeek?: number | null; [k: string]: any }>) {
  const hasPerDay = items.some((it) => it.dayOfWeek != null)
  if (!hasPerDay) return null
  const byDay = new Map<number, typeof items>()
  for (const it of items) {
    const d = it.dayOfWeek
    if (d == null) continue
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d)!.push(it)
  }
  return byDay.size ? byDay : null
}

export default function SubscriptionDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : ''
  const getSubscription = useSubscriptionStore((s) => s.getSubscription)
  const setSubscriptions = useSubscriptionStore((s) => s.setSubscriptions)
  const updateSubscription = useSubscriptionStore((s) => s.updateSubscription)
  const subscriptions = useSubscriptionStore((s) => s.subscriptions)

  const [loaded, setLoaded] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [fetchedById, setFetchedById] = useState(false)
  // subscriptions в зависимостях: иначе при прямом заходе (из уведомления бота) рацион, пришедший
  // в стор после загрузки, не подхватывался и страница показывала «не найдена»
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subscription = useMemo(() => (id ? getSubscription(id) : undefined), [id, getSubscription, subscriptions])

  const addSubscription = useSubscriptionStore((s) => s.addSubscription)

  useEffect(() => {
    if (subscriptions.length > 0) {
      setLoaded(true)
      return
    }
    let cancelled = false
    async function fetchSubs() {
      try {
        const res = await fetch('/api/subscriptions', {
          cache: 'no-store',
          credentials: 'include',
          headers: { ...telegramInitHeaderRecord() },
        })
        const data = await res.json().catch(() => null)
        if (!cancelled && res.ok && data?.ok && Array.isArray(data?.subscriptions)) {
          const normalized = data.subscriptions.map((s: any) => ({
            ...s,
            price: Number(s?.price ?? 0),
            startDate: s?.startDate ? new Date(s.startDate) : new Date(),
            nextDelivery: s?.nextDelivery ? new Date(s.nextDelivery) : undefined,
            items: Array.isArray(s?.items) ? s.items : [],
          }))
          setSubscriptions(normalized as any)
          setLoaded(true)
        } else {
          setLoaded(true)
        }
      } catch {
        if (!cancelled) setLoaded(true)
      }
    }
    fetchSubs()
    return () => {
      cancelled = true
    }
  }, [subscriptions.length, setSubscriptions])

  useEffect(() => {
    if (!id || !loaded || subscription || fetchedById) return
    let cancelled = false
    fetch(`/api/subscriptions/${id}`, {
      cache: 'no-store',
      credentials: 'include',
      headers: { ...telegramInitHeaderRecord() },
    })
      .then((res) => res.json().catch(() => null))
      .then((data) => {
        if (cancelled) return
        setFetchedById(true)
        if (data?.ok && data?.subscription) {
          const s = data.subscription as any
          const normalized = {
            ...s,
            id: s.id,
            price: Number(s?.price ?? 0),
            startDate: s?.startDate ? new Date(s.startDate) : new Date(),
            nextDelivery: s?.nextDelivery ? new Date(s.nextDelivery) : undefined,
            items: Array.isArray(s?.items) ? s.items : [],
          }
          addSubscription(normalized)
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedById(true)
      })
    return () => {
      cancelled = true
    }
  }, [id, loaded, subscription, fetchedById, addSubscription])

  if (!id) {
    router.replace('/subscriptions')
    return null
  }

  if (loaded && !subscription && fetchedById) {
    return (
      <Screen title="подписка" back="/subscriptions">
        <Empty
          title="Подписка не найдена"
          action={
            <Link href="/subscriptions" prefetch={false} scroll={false}>
              <Btn variant="secondary">мои подписки</Btn>
            </Link>
          }
        />
      </Screen>
    )
  }

  if (!subscription) {
    return (
      <Screen title="подписка" back="/subscriptions">
        <Card className="mt-2 text-center">
          <p className="text-[14px] text-[color:var(--muted)]">Загрузка…</p>
        </Card>
      </Screen>
    )
  }

  const statusLabel = SUBSCRIPTION_STATUSES[subscription.status as keyof typeof SUBSCRIPTION_STATUSES] ?? subscription.status
  const nearestEvent = getNearestEventLabel(subscription.nextDelivery, subscription.deliveryTime)
  const days: number[] = Array.isArray(subscription.deliveryDays) ? subscription.deliveryDays : []
  const timeLabel = subscription.deliveryTime ? String(subscription.deliveryTime) : null
  const items = Array.isArray(subscription.items) ? subscription.items : []
  const itemsByDay = groupItemsByDay(items)
  const canChange = canEditSubscription(
    { status: subscription.status, nextDelivery: subscription.nextDelivery },
    new Date()
  )
  const cutoffDate = subscription.nextDelivery ? getDeliveryCutoff(subscription.nextDelivery) : null
  const nextDate = subscription.nextDelivery ? new Date(subscription.nextDelivery) : null
  const timeStr = subscription.deliveryTime ?? '13:00'
  const cutoffHint =
    cutoffDate && canChange && nextDate
      ? `Доставка ${nextDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })} в ${timeStr} — изменения до ${cutoffDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      : null

  const deliveries = (subscription as any)?.deliveries as Array<{ id: string; scheduledDate: string; status: string }> | null
  const deliveriesList = Array.isArray(deliveries) ? deliveries : []
  const received = deliveriesList.filter((d: any) => d.status === 'DELIVERED')
  const inProgress = deliveriesList.filter((d: any) => d.status === 'SCHEDULED' || d.status === 'CONFIRMED')
  const totalDeliveries = received.length + inProgress.length
  const progressPercent = totalDeliveries > 0 ? (received.length / totalDeliveries) * 100 : 0

  const upcoming = [...inProgress].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
  const nextDay = nextDate?.getDay() ?? -1
  const periodDays = Number((subscription as any)?.periodDays ?? 0)
  const personCount = Number((subscription as any)?.personCount ?? 1)
  const statusTone = subscription.status === 'ACTIVE' ? 'ok' : subscription.status === 'PENDING' ? 'warn' : 'muted'

  return (
    <Screen title={subscription.name} back="/subscriptions">
      <div className="flex flex-col gap-2.5">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[color:var(--muted)]">
                {subscription.status === 'ACTIVE' || subscription.status === 'PAUSED' ? nearestEvent : 'рацион'}
              </div>
              <div className="mt-0.5 text-[26px] font-bold tracking-tight text-[color:var(--text)]">{formatPrice(subscription.price)}</div>
            </div>
            <Badge tone={statusTone}>{String(statusLabel).toLowerCase()}</Badge>
          </div>
          <div className="mt-0.5 text-[12.5px] text-[color:var(--muted)]">
            {[periodShort(periodDays), `${days.length} ${plural(days.length, 'день', 'дня', 'дней')} в неделю`, timeLabel, personCount > 1 ? `${personCount} персоны` : '']
              .filter(Boolean)
              .join(' · ')}
          </div>
        </Card>

        {subscription.status === 'PENDING' ? (
          <div className="rounded-[20px] bg-[color:var(--warn-bg)] px-3.5 py-3">
            <div className="text-[14px] font-semibold text-[color:var(--warn)]">ждёт подтверждения ресторана</div>
            <div className="mt-0.5 text-[12.5px] text-[color:var(--warn)] opacity-90">ответ придёт в Telegram. пока заявку не подтвердили, её можно изменить.</div>
            {canChange ? (
              <Link href={`/subscriptions/new?resume=${id}`} prefetch={false} className="mt-2 inline-block">
                <Btn variant="secondary">изменить заявку</Btn>
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* неделя строками, как в конструкторе */}
        <Card className="!px-3.5 !py-1.5">
          {MON_FIRST.map((d, i) => {
            const on = days.includes(d)
            const dayItems = on ? (itemsByDay ? itemsByDay.get(d) ?? [] : items) : []
            const isNext = on && nextDay === d && (subscription.status === 'ACTIVE' || subscription.status === 'PAUSED')
            return (
              <div key={d} className={i > 0 ? 'flex min-h-[52px] items-center gap-2.5 border-t border-[color:var(--stroke)] py-1.5' : 'flex min-h-[52px] items-center gap-2.5 py-1.5'}>
                <span className={on ? 'w-8 shrink-0 text-[13px] font-semibold text-[color:var(--text)]' : 'w-8 shrink-0 text-[13px] font-semibold text-[color:var(--muted)]'}>
                  {DAY_LOWER[d]}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {!on ? (
                    <span className="text-[13px] text-[color:var(--muted)]">без доставки</span>
                  ) : dayItems.length ? (
                    dayItems.map((it: any, k: number) => (
                      <span key={it?.id ?? `${it?.dishId}-${k}`} className="max-w-full truncate rounded-full bg-[color:var(--bg)] px-3 py-1.5 text-[13px] text-[color:var(--text)]">
                        {itemLabel(it)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-[color:var(--muted)]">доставка</span>
                  )}
                </span>
                {isNext ? <Badge tone="ok">ближайшая</Badge> : null}
              </div>
            )
          })}
        </Card>

        {totalDeliveries > 0 ? (
          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold text-[color:var(--text)]">получено</span>
              <span className="text-[14px] font-semibold tabular-nums text-[color:var(--text)]">
                {received.length} <span className="font-normal text-[color:var(--muted)]">из {totalDeliveries}</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface)]">
              <div className="h-full rounded-full bg-[color:var(--ok)] transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            {upcoming.length ? (
              <div className="mt-3 border-t border-[color:var(--stroke)] pt-1">
                {upcoming.slice(0, 5).map((dl: any, i: number) => {
                  const date = new Date(dl.scheduledDate)
                  return (
                    <div key={dl.id} className={i > 0 ? 'flex min-h-[40px] items-center justify-between border-t border-[color:var(--stroke)]' : 'flex min-h-[40px] items-center justify-between'}>
                      <span className="text-[13.5px] text-[color:var(--text)]">
                        {date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}
                      </span>
                      <span className="text-[12.5px] text-[color:var(--muted)]">{dl.status === 'CONFIRMED' ? 'готовим' : 'запланирована'}</span>
                    </div>
                  )
                })}
                {upcoming.length > 5 ? <div className="pt-1 text-[12.5px] text-[color:var(--muted)]">и ещё {upcoming.length - 5}</div> : null}
              </div>
            ) : null}
          </Card>
        ) : null}

        {canChange ? (
          <p className="px-1 text-[12.5px] text-[color:var(--muted)]">
            {cutoffHint ? `${cutoffHint}. изменения применяются к будущим доставкам.` : 'изменения применяются только к будущим доставкам.'}
          </p>
        ) : null}

        <div className="mt-1 flex flex-col gap-2">
          {canChange && subscription.status !== 'PENDING' ? (
            <Link href={`/subscriptions/new?composition=${subscription.id}`} prefetch={false} scroll={false}>
              <Btn full>изменить блюда</Btn>
            </Link>
          ) : null}
          {subscription.status === 'ACTIVE' || subscription.status === 'EXPIRED' ? (
            <Link href="/subscriptions/new" prefetch={false} scroll={false}>
              <Btn variant="secondary" full>{subscription.status === 'EXPIRED' ? 'собрать заново' : 'собрать ещё один'}</Btn>
            </Link>
          ) : null}
          {subscription.status === 'ACTIVE' ? (
            <button
              type="button"
              disabled={cancelLoading}
              className="h-11 text-[13.5px] font-semibold text-[color:var(--danger)] disabled:opacity-50"
              onClick={async () => {
                if (!confirm('Отменить подписку? Изменения вступают в силу после текущего периода.')) return
                setCancelLoading(true)
                try {
                  const res = await fetch(`/api/subscriptions/${subscription.id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'content-type': 'application/json', ...telegramInitHeaderRecord() },
                    body: JSON.stringify({ status: 'CANCELLED' }),
                  })
                  const data = await res.json().catch(() => null)
                  if (res.ok && data?.ok) {
                    updateSubscription(subscription.id, { status: 'CANCELLED' })
                    router.push('/subscriptions')
                  } else {
                    alert(data?.error || 'Не удалось отменить')
                  }
                } catch {
                  alert('Ошибка сети')
                } finally {
                  setCancelLoading(false)
                }
              }}
            >
              {cancelLoading ? 'отменяем…' : 'отменить подписку'}
            </button>
          ) : null}
        </div>
      </div>
    </Screen>
  )
}
