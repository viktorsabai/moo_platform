'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { SubscriptionCheckoutFlow } from '@/features/subscriptions/components/SubscriptionCheckoutFlow'
import { SubscriptionWizard } from '@/features/subscriptions/components/SubscriptionWizard'
import { useVenue } from '@/lib/venue-context'
import { SubscriptionUnavailableCard } from '@/components/subscriptions/SubscriptionUnavailableCard'
import { PageHeader } from '@/components/ui/PageHeader'

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
      <main className="ui-container ui-screen">
        <PageHeader title="новая подписка" backHref="/subscriptions" compact className="mb-3" />
        <SubscriptionUnavailableCard />
      </main>
    )
  }

  return (
    <Suspense fallback={<p className="text-[13px] text-[color:var(--muted)]">загрузка…</p>}>
      <NewSubscriptionContent />
    </Suspense>
  )
}
