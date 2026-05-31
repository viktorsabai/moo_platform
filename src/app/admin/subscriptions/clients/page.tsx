import { redirect } from 'next/navigation'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { getAdminSubscriptions } from '@/lib/get-admin-subscriptions'
import { AdminSubscriptionClientsPanel } from '../AdminSubscriptionClientsPanel'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionClientsPage() {
  const ctx = await getRestaurantContext()
  try {
    const admin = requireRestaurantAdmin(ctx)
    const initialClientSubscriptions = await getAdminSubscriptions(admin.restaurantId)
    return <AdminSubscriptionClientsPanel initialClientSubscriptions={initialClientSubscriptions} />
  } catch {
    redirect('/profile')
  }
}
