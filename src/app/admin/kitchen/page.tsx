import { Screen } from '@/components/kit'
import { AdminKitchen } from '@/features/admin/AdminKitchen'

export default function AdminKitchenPage() {
  return (
    <Screen title="кухня" subtitle="что готовить: заказы и рационы вместе">
      <AdminKitchen />
    </Screen>
  )
}
