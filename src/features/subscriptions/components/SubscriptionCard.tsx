'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Subscription } from '@/types'
import { formatPrice, formatDate } from '@/lib/utils'
import { SUBSCRIPTION_STATUSES, SUBSCRIPTION_PLANS } from '@/lib/constants'
import toast from 'react-hot-toast'

interface SubscriptionCardProps {
  subscription: Subscription
}

const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handlePause = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    toast.success('Подписка приостановлена')
    setIsLoading(false)
  }

  const handleResume = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    toast.success('Подписка возобновлена')
    setIsLoading(false)
  }

  const handleCancel = async () => {
    if (!confirm('Вы уверены, что хотите отменить подписку?')) return
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    toast.success('Подписка отменена')
    setIsLoading(false)
  }

  const statusConfig = {
    ACTIVE: { chip: 'border-black/10 bg-black/[0.02] text-black/70', dot: 'bg-emerald-500' },
    PAUSED: { chip: 'border-black/10 bg-black/[0.02] text-black/70', dot: 'bg-amber-500' },
    CANCELLED: { chip: 'border-black/10 bg-black/[0.02] text-black/70', dot: 'bg-rose-500' },
    EXPIRED: { chip: 'border-black/10 bg-black/[0.02] text-black/70', dot: 'bg-zinc-400' },
  } as const

  const status = statusConfig[subscription.status as keyof typeof statusConfig] ?? statusConfig.ACTIVE

  return (
    <div className="ui-surface-strong p-4">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-[18px] font-semibold text-black/90">{subscription.name}</h3>
            <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.chip}`}>
              <span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden="true" />
              <span>{SUBSCRIPTION_STATUSES[subscription.status]}</span>
            </span>
          </div>
          <div className="mt-1 text-[13px] font-medium text-black/45">{SUBSCRIPTION_PLANS[subscription.plan]} · управление в telegram</div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[18px] font-extrabold tabular-nums text-[color:var(--accent)]">
            {formatPrice(subscription.price)}
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-black/35">в месяц · ~{subscription.deliveryDays.length * 4} доставок</div>
        </div>
      </div>

      {/* schedule */}
      <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <div className="text-[12px] font-semibold text-black/45">дни доставки</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subscription.deliveryDays.map((day) => (
                <span
                  key={day}
                  className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-black/70"
                >
                  {weekdays[day]}
                </span>
              ))}
            </div>
          </div>

          <div className="sm:col-span-1">
            <div className="text-[12px] font-semibold text-black/45">время</div>
            <div className="mt-2 text-[14px] font-semibold text-black/80">
              {subscription.deliveryTime ?? '—'}
            </div>
          </div>

          <div className="sm:col-span-1">
            <div className="text-[12px] font-semibold text-black/45">следующая доставка</div>
            <div className="mt-2 text-[14px] font-semibold text-black/80">
              {subscription.nextDelivery ? formatDate(subscription.nextDelivery) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* items */}
      <div className="mt-4">
        <div className="mb-2 text-[13px] font-semibold text-black/70">состав</div>
        <div className="flex flex-wrap gap-2">
          {subscription.items.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-[12px] font-semibold text-black/70"
            >
              {item.dish.name} × {item.quantity}
            </span>
          ))}
        </div>
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-black/10 pt-4">
        <Link
          href={`/subscriptions/${subscription.id}`}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/70 transition active:scale-[0.98]"
        >
          детали
        </Link>

        {subscription.status === 'ACTIVE' && (
          <>
            <button
              type="button"
              onClick={handlePause}
              disabled={isLoading}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/70 transition active:scale-[0.98] disabled:opacity-40"
            >
              пауза
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isLoading}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-rose-600 transition active:scale-[0.98] disabled:opacity-40"
            >
              отменить
            </button>
          </>
        )}

        {subscription.status === 'PAUSED' && (
          <button
            type="button"
            onClick={handleResume}
            disabled={isLoading}
            className="btn btn-primary inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-40"
          >
            продолжить
          </button>
        )}
      </div>
    </div>
  )
}
