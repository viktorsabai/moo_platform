'use client'

import Link from 'next/link'
import { cn, formatPrice } from '@/lib/utils'
import { getNearestEventLabel } from '@/lib/utils'
import { SUBSCRIPTION_STATUS_FILTERS, SUBSCRIPTION_STATUS_TO_FILTER } from '@/lib/constants'
import { InlineReveal } from '@/components/ui/InlineReveal'
import type { Subscription } from '@/types'

export interface SubscriptionListCardProps {
  subscription: Subscription
  isFocused?: boolean
  onFocus?: () => void
  className?: string
}

/** Превью: быстрое оперативное — следующая доставка, прогресс. Подробности по тапу в деталь. */
export function SubscriptionListCard({ subscription, isFocused = false, onFocus, className }: SubscriptionListCardProps) {
  const filterKey = SUBSCRIPTION_STATUS_TO_FILTER[subscription.status] ?? 'active'
  const statusLabel = SUBSCRIPTION_STATUS_FILTERS[filterKey]
  const nearestEvent = getNearestEventLabel(subscription.nextDelivery, subscription.deliveryTime)
  const deliveries = (subscription as any)?.deliveries as Array<{ status: string }> | undefined
  const deliveredCount = Array.isArray(deliveries) ? deliveries.filter((d) => d.status === 'DELIVERED').length : 0
  const totalDeliveries = Array.isArray(deliveries) ? deliveries.filter((d) => d.status !== 'CANCELLED').length : 0
  const progressPercent = totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 0

  return (
    <div
      className={cn(
        'overflow-hidden transition',
        'border border-[length:1px]',
        isFocused && 'ring-2',
        className
      )}
      style={{
        borderRadius: 'var(--radius-large)',
        borderColor: 'var(--stroke)',
        background: 'var(--surface-strong)',
        boxShadow: isFocused ? '0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)' : 'var(--shadow-card)',
      }}
    >
      <button
        type="button"
        onClick={() => onFocus?.()}
        className="block w-full text-left p-4 transition active:scale-[0.99]"
        aria-expanded={isFocused}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="ui-h2 line-clamp-1">{subscription.name}</h3>
            <p className="ui-muted mt-1 text-[13px]">{nearestEvent}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="ui-h1 tabular-nums">{formatPrice(subscription.price)}</div>
            <span
              className="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--text) 8%, transparent)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--text)',
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </button>

      <InlineReveal open={isFocused}>
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--stroke)' }}>
          {/* Превью = когда следующая + прогресс. Подробности — в детали. */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                следующая доставка
              </p>
              <p className="mt-0.5 text-[14px] font-semibold">{nearestEvent}</p>
            </div>
            {totalDeliveries > 0 && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                    прогресс
                  </p>
                  <span className="text-[12px] tabular-nums font-semibold">
                    {deliveredCount}/{totalDeliveries}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--stroke) 60%, transparent)',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progressPercent}%`,
                      background: 'var(--accent)',
                      borderRadius: 'var(--radius-pill)',
                    }}
                  />
                </div>
              </div>
            )}
            <Link
              href={`/subscriptions/${subscription.id}`}
              prefetch={false}
              className="btn btn-primary mt-1 inline-flex w-full justify-center rounded-full py-2.5 text-[13px] font-semibold"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              подробнее
            </Link>
          </div>
        </div>
      </InlineReveal>
    </div>
  )
}
