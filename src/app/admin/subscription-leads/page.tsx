import { redirect } from 'next/navigation'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { SubscriptionLeadsClient } from './subscription-leads-client'

export const dynamic = 'force-dynamic'

export default async function SubscriptionLeadsPage() {
  const ctx = await getRestaurantContext()
  try {
    requireRestaurantAdmin(ctx)
    return <SubscriptionLeadsClient />
  } catch {
    redirect('/profile')
  }
}
