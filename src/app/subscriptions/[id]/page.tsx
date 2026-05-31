'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSubscriptionStore } from '@/store/subscription-store'
import { formatPrice, getNearestEventLabel } from '@/lib/utils'
import { SUBSCRIPTION_STATUSES } from '@/lib/constants'
import { canEditSubscription, getDeliveryCutoff } from '@/lib/subscription-rules'
import { PageHeader } from '@/components/ui/PageHeader'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function ItemLine({ it }: { it: any }) {
  const qty = Math.max(1, Number(it?.quantity ?? 1))
  const name = it?.dish?.name ?? 'блюдо'
  const src = typeof it?.dish?.image === 'string' ? it.dish.image.trim() : ''
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
        {src ? <OptimizedImage src={src} alt="" className="object-cover" sizes={IMAGE_SIZES.checkoutThumb} /> : null}
      </span>
      <span className="min-w-0 truncate">
        {qty > 1 ? `${qty}× ` : ''}
        {name}
      </span>
    </span>
  )
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
  const subscription = useMemo(() => (id ? getSubscription(id) : undefined), [id, getSubscription])

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
      <main className="ui-container ui-screen">
        <PageHeader backHref="/subscriptions" title="подписка" />
        <div className="ui-surface-card mt-6 text-center">
          <p className="ui-body">Подписка не найдена</p>
          <Link
            href="/subscriptions"
            prefetch={false}
            scroll={false}
            className="btn btn-soft mt-3 inline-flex rounded-full px-4"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            мои подписки
          </Link>
        </div>
      </main>
    )
  }

  if (!subscription) {
    return (
      <main className="ui-container ui-screen">
        <PageHeader backHref="/subscriptions" title="подписка" />
        <div className="ui-surface-card mt-6 text-center">
          <p className="ui-muted text-[14px]">Загрузка…</p>
        </div>
      </main>
    )
  }

  const statusLabel = SUBSCRIPTION_STATUSES[subscription.status as keyof typeof SUBSCRIPTION_STATUSES] ?? subscription.status
  const nearestEvent = getNearestEventLabel(subscription.nextDelivery, subscription.deliveryTime)
  const days: number[] = Array.isArray(subscription.deliveryDays) ? subscription.deliveryDays : []
  const timeLabel = subscription.deliveryTime ? String(subscription.deliveryTime) : null
  const items = Array.isArray(subscription.items) ? subscription.items : []
  const itemsByDay = groupItemsByDay(items)
  const itemsCount = items.reduce((sum, it) => sum + Math.max(0, Number(it?.quantity ?? 0)), 0)
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

  const deliveryCards = [
    ...inProgress.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
    ...received.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()),
  ]

  const todayDay = new Date().getDay()
  const nextDay = nextDate?.getDay() ?? -1

  return (
    <main className="ui-container ui-screen">
      {/* Шапка: компактно — назад, название, статус, цена */}
      <PageHeader
        backHref="/subscriptions"
        title={subscription.name}
        action={
          <div className="flex flex-col items-end gap-0.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--text) 8%, transparent)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--text)',
              }}
            >
              {statusLabel}
            </span>
            <span className="text-[13px] font-bold tabular-nums">{formatPrice(subscription.price)}</span>
          </div>
        }
      />

      {/* Визуальный timeline: дни недели, доставки, следующий, выходные */}
      <div className="ui-surface-card mt-4">
        <p className="ui-muted mb-3 text-[11px] font-semibold uppercase tracking-wide">расписание</p>
        <div className="flex justify-between gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const isDeliveryDay = days.includes(d)
            const isNext = nextDay === d
            const isToday = todayDay === d
            return (
              <div
                key={d}
                className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2"
                style={{
                  background: isNext
                    ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                    : isDeliveryDay
                      ? 'color-mix(in srgb, var(--text) 4%, transparent)'
                      : 'transparent',
                  borderRadius: 'var(--radius-small)',
                }}
              >
                <span
                  className="text-[11px] font-semibold"
                  style={{
                    color: isNext ? 'var(--accent)' : isDeliveryDay ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  {WEEKDAYS_SHORT[d]}
                </span>
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: isDeliveryDay
                      ? isNext
                        ? 'var(--accent)'
                        : 'var(--text)'
                      : 'transparent',
                  }}
                />
                {!isDeliveryDay && (
                  <span className="text-[9px]" style={{ color: 'var(--muted)' }}>
                    —
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <p className="ui-muted mt-2 text-[12px]">
          {nearestEvent}
          {timeLabel ? ` · ${timeLabel}` : ''}
        </p>
      </div>

      {/* Прогресс: нативный прогресс-бар */}
      {totalDeliveries > 0 && (
        <section className="mt-4" aria-label="прогресс">
          <div className="ui-surface-card">
            <div className="flex items-center justify-between gap-3">
              <p className="ui-h2 text-[13px]">прогресс</p>
              <span className="tabular-nums" style={{ color: 'var(--text)' }}>
                <span className="font-bold" style={{ color: 'var(--accent)' }}>{received.length}</span>
                <span className="ui-muted text-[12px]">/{totalDeliveries}</span>
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--stroke) 60%, transparent)',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-strong))',
                  borderRadius: 'var(--radius-pill)',
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Карусель: дата + состав (по дням если есть рационность) */}
      <section className="mt-4" aria-label="доставки и состав">
        <p className="ui-h2 mb-2 text-[13px]">
          {itemsByDay
            ? `рацион по дням · ${itemsCount} порц.`
            : items.length > 0
              ? `состав доставки · ${itemsCount} порц.`
              : 'доставки'}
        </p>
        {deliveryCards.length > 0 ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {deliveryCards.map((d: any) => {
              const date = new Date(d.scheduledDate)
              const dayNum = date.getDay()
              const isDelivered = d.status === 'DELIVERED'
              const dayItems = itemsByDay ? (itemsByDay.get(dayNum) ?? items) : items
              return (
                <div
                  key={d.id}
                  className="flex min-w-[160px] max-w-[180px] shrink-0 flex-col overflow-hidden rounded-2xl border p-3"
                  style={{
                    borderRadius: 'var(--radius-large)',
                    borderColor: isDelivered ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--stroke)',
                    background: isDelivered ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--surface)',
                  }}
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: 'var(--muted)' }}
                  >
                    {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold">{WEEKDAYS_SHORT[dayNum]}</p>
                  <p
                    className="mt-1 text-[11px] font-semibold"
                    style={{ color: isDelivered ? 'var(--accent)' : 'var(--muted)' }}
                  >
                    {isDelivered ? 'получено' : 'ожидается'}
                  </p>
                  {dayItems.length > 0 && (
                    <ul className="mt-2 space-y-0.5 border-t pt-2" style={{ borderColor: 'var(--stroke)' }}>
                      {dayItems.slice(0, 3).map((it) => (
                          <li
                            key={(it as any)?.id ?? (it as any)?.dishId ?? Math.random()}
                            className="text-[12px]"
                            style={{ color: 'var(--text)' }}
                          >
                            <ItemLine it={it} />
                          </li>
                        ))}
                      {dayItems.length > 3 && (
                        <li className="text-[11px]" style={{ color: 'var(--muted)' }}>
                          +{dayItems.length - 3}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        ) : items.length > 0 ? (
          <div className="ui-surface-card">
            {itemsByDay ? (
              <div className="space-y-4">
                {Array.from(itemsByDay.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([dayNum, dayItems]) => (
                    <div key={dayNum}>
                      <p className="text-[11px] font-semibold uppercase" style={{ color: 'var(--muted)' }}>
                        {WEEKDAYS_SHORT[dayNum]}
                      </p>
                      <ul className="mt-1 space-y-1.5">
                        {dayItems.map((it) => (
                            <li key={(it as any)?.id ?? (it as any)?.dishId} className="text-[14px]">
                              <ItemLine it={it} />
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {items.map((it) => (
                    <li key={(it as any)?.id ?? (it as any)?.dishId} className="text-[14px]">
                      <ItemLine it={it} />
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {canChange && (
        <p className="ui-muted mt-4 text-[12px]">
          {cutoffHint
            ? `${cutoffHint}. Изменения применяются к будущим доставкам.`
            : 'Изменения применяются только к будущим доставкам.'}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {canChange && (
          <Link
            href={`/subscriptions/new?composition=${subscription.id}`}
            prefetch={false}
            scroll={false}
            className="btn btn-soft block w-full rounded-full py-2.5 text-center text-[14px] font-semibold"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            изменить состав
          </Link>
        )}

        {subscription.status === 'ACTIVE' && (
          <button
            type="button"
            disabled={cancelLoading}
            className="btn btn-soft block w-full rounded-full py-2.5 text-[14px] font-semibold disabled:opacity-60"
            style={{ borderRadius: 'var(--radius-pill)', color: 'var(--text)' }}
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
            {cancelLoading ? 'отмена…' : 'отменить подписку'}
          </button>
        )}

        {(subscription.status === 'ACTIVE' || subscription.status === 'EXPIRED') && (
          <Link
            href="/subscriptions/new"
            prefetch={false}
            scroll={false}
            className="btn btn-primary block w-full rounded-full py-2.5 text-center text-[14px] font-semibold"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            продлить / оформить заново
          </Link>
        )}
      </div>
    </main>
  )
}
