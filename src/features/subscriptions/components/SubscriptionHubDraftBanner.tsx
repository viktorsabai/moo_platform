'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useVenue } from '@/lib/venue-context'
import { loadSubscriptionBuilderDraft, type SubscriptionBuilderDraft } from '@/lib/subscription-builder-draft'
import { WEEKDAYS } from '@/features/subscriptions/lib/subscription-checkout-utils'

export function SubscriptionHubDraftBanner() {
  const { restaurantId } = useVenue()
  const [draft, setDraft] = useState<SubscriptionBuilderDraft | null>(null)

  useEffect(() => {
    setDraft(loadSubscriptionBuilderDraft(restaurantId))
    const refresh = () => setDraft(loadSubscriptionBuilderDraft(restaurantId))
    window.addEventListener('storage', refresh)
    window.addEventListener('ufo:subscription-draft', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('ufo:subscription-draft', refresh)
    }
  }, [restaurantId])

  if (!draft || draft.lines.length === 0) return null

  const daysLabel = draft.selectedDays.map((d) => WEEKDAYS[d]).join(', ')

  return (
    <Link
      href="/subscriptions/new"
      prefetch={false}
      className="mb-4 flex items-center gap-3 rounded-[var(--radius-large)] border border-[color:var(--accent)]/35 bg-[color:var(--accent)]/10 px-4 py-3 transition active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--text)] text-[18px] text-[color:var(--surface)]">
        →
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight">продолжить сбор</p>
        <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">
          {draft.lines.length} блюд
          {daysLabel ? ` · ${daysLabel}` : ''}
          {draft.phase === 'checkout' ? ' · почти готово' : ''}
        </p>
      </div>
    </Link>
  )
}
