'use client'

import { Suspense } from 'react'
import { SubscriptionCheckoutFlow } from '@/features/subscriptions/components/SubscriptionCheckoutFlow'
import { useVenue } from '@/lib/venue-context'
import { SubscriptionUnavailableCard } from '@/components/subscriptions/SubscriptionUnavailableCard'
import { Screen } from '@/components/kit'

/** создание, ?resume=<id> (заявка) и ?composition=<id> (изменить блюда) — один поток */
function NewSubscriptionContent() {
  return <SubscriptionCheckoutFlow />
}

export default function NewSubscriptionPage() {
  const { settings } = useVenue()

  if (!settings.subscriptionEnabled) {
    return (
      <Screen title="оформление" back="/subscriptions" subtitle="новая подписка">
        <SubscriptionUnavailableCard />
      </Screen>
    )
  }

  return (
    <Suspense fallback={<p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>}>
      <NewSubscriptionContent />
    </Suspense>
  )
}
