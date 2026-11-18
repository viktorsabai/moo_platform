import { redirect } from 'next/navigation'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { AdminLeadsClient } from './admin-leads-client'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage() {
  const ctx = await getRestaurantContext()
  try {
    requireRestaurantAdmin(ctx)
    return <AdminLeadsClient />
  } catch {
    redirect('/profile')
  }
}
