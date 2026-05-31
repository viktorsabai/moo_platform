'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatPrice, formatDate } from '@/lib/utils'
import { IconChevronUp, IconCopy, IconPencil } from './icons'
import { InlineReveal } from './InlineReveal'
import type { Subscription } from '@/types'

export interface SubscriptionRailCardProps {
  subscription: Subscription
  onExpand?: (id: string) => void
  expanded?: boolean
  className?: string
}

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export function SubscriptionRailCard({
  subscription,
  onExpand,
  expanded = false,
  className,
}: SubscriptionRailCardProps) {
  const days: number[] = Array.isArray(subscription.deliveryDays) ? subscription.deliveryDays : []
  const daysLabel = days.length
    ? days.map((d) => WEEKDAYS_SHORT[Number(d)]).filter(Boolean).join(', ')
    : null
  const timeLabel = subscription.deliveryTime ? String(subscription.deliveryTime) : null
  const next = subscription.nextDelivery ? formatDate(subscription.nextDelivery) : null
  const itemsCount = Array.isArray(subscription.items)
    ? subscription.items.reduce((sum, it) => sum + Math.max(0, Number(it?.quantity ?? 0)), 0)
    : 0

  const statusDot =
    subscription.status === 'ACTIVE'
      ? 'bg-[color:var(--accent)]'
      : subscription.status === 'PAUSED'
        ? 'bg-black/30'
        : 'bg-black/20'

  const subtitle = [
    daysLabel ? `дни: ${daysLabel}` : null,
    timeLabel ? timeLabel : null,
    next ? `след. ${next}` : null,
    itemsCount ? `${itemsCount} порц.` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={cn('snap-start', className)}>
      <div className="ui-surface-strong flex h-[280px] w-[200px] flex-col justify-between overflow-hidden p-4 transition active:scale-[0.99]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="ui-h2 line-clamp-2">{subscription.name}</div>
            {subtitle && <div className="ui-muted mt-1 text-[12px] line-clamp-2">{subtitle}</div>}
          </div>
          <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full mt-1', statusDot)} />
        </div>

        <div className="mt-auto">
          <div className="ui-h1 tabular-nums">{formatPrice(subscription.price)}</div>
          <button
            type="button"
            onClick={() => onExpand?.(subscription.id)}
            className="ui-muted mt-2 inline-flex items-center rounded-full bg-black/[0.04] px-3 py-2 text-[13px] font-semibold transition active:opacity-80"
          >
            детали
            <IconChevronUp
              className={cn('ml-1 h-4 w-4 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 ui-surface overflow-hidden">
          <InlineReveal open={expanded}>
            <div className="px-4 pb-4 pt-3">
              <div className="ui-muted text-[12px]">
                {next ? `ближайшая доставка: ${next}` : 'ближайшая доставка: —'}
              </div>
              <div className="ui-muted mt-1 text-[12px]">
                {daysLabel ? `дни: ${daysLabel}` : 'дни: —'}
                {timeLabel ? ` · ${timeLabel}` : ''}
              </div>
              <div className="ui-muted mt-2 text-[12px]">
                состав: {itemsCount ? `${itemsCount} порц.` : 'не задан'}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const url = `${window.location.origin}/subscriptions?subscriptionId=${encodeURIComponent(String(subscription.id))}`
                      navigator.clipboard?.writeText(url).catch(() => {})
                    } catch {}
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/60 text-black/70 transition active:opacity-80"
                  aria-label="копировать ссылку"
                >
                  <IconCopy className="h-5 w-5" />
                </button>

                <Link
                  href={`/subscriptions/${subscription.id}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white/60 px-4 text-[13px] font-semibold text-black/70 transition active:opacity-80"
                >
                  <IconPencil className="h-5 w-5" />
                  <span>редактировать</span>
                </Link>
              </div>
            </div>
          </InlineReveal>
        </div>
      )}
    </div>
  )
}
