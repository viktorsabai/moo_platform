'use client'

import { SubscriptionWizard } from '@/features/subscriptions/components/SubscriptionWizard'
import { useVenue } from '@/lib/venue-context'
import { SubscriptionUnavailableCard } from '@/components/subscriptions/SubscriptionUnavailableCard'
import { PageHeader } from '@/components/ui/PageHeader'

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
    <main className="ui-container ui-screen flex min-h-[100dvh] flex-col">
      <SubscriptionWizard />
    </main>
  )
}
