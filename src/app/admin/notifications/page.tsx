import { Screen } from '@/components/kit'
import { AdminNotificationsCatalog } from '@/components/admin/AdminNotificationsCatalog'

export default function AdminNotificationsPage() {
  return (
    <Screen
      title="уведомления"
      subtitle="каталог Telegram-событий: кто получает, когда срабатывает и что нужно настроить"
      back="/admin"
      className="!pb-20 min-w-0 max-w-full overflow-x-hidden"
    >
      <AdminNotificationsCatalog />
    </Screen>
  )
}
