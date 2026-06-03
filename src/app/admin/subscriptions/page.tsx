import { redirect } from 'next/navigation'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { AdminSubscriptionDashboard } from './AdminSubscriptionDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  try {
    const ctx = await getRestaurantContext()
    requireRestaurantAdmin(ctx)
    return <AdminSubscriptionDashboard />
  } catch {
    redirect('/profile/owner')
  }
}
