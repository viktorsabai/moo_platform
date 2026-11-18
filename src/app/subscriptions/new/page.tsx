'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { SubscriptionCheckoutFlow } from '@/features/subscriptions/components/SubscriptionCheckoutFlow'
import { SubscriptionWizard } from '@/features/subscriptions/components/SubscriptionWizard'
import { useVenue } from '@/lib/venue-context'
import { SubscriptionUnavailableCard } from '@/components/subscriptions/SubscriptionUnavailableCard'
import { Screen } from '@/components/kit'

function NewSubscriptionContent() {
  const searchParams = useSearchParams()
  const editId = searchParams.get('composition') || searchParams.get('edit') || ''

  if (editId) {
    return <SubscriptionWizard />
  }
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
