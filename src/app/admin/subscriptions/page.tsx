import { redirect } from 'next/navigation'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { getAdminSubscriptions } from '@/lib/get-admin-subscriptions'
import { AdminSubscriptionsView } from './AdminSubscriptionsClient'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage() {
  const ctx = await getRestaurantContext()
  try {
    const admin = requireRestaurantAdmin(ctx)
    const initialClientSubscriptions = await getAdminSubscriptions(admin.restaurantId)
    return <AdminSubscriptionsView initialClientSubscriptions={initialClientSubscriptions} />
  } catch {
    redirect('/profile')
  }
}
