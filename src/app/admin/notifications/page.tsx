import Link from 'next/link'
import { AdminNotificationsCatalog } from '@/components/admin/AdminNotificationsCatalog'

export default function AdminNotificationsPage() {
  return (
    <main className="ui-container ui-screen !pb-20 min-w-0 max-w-full overflow-x-hidden">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/admin"
          className="text-[13px] font-medium text-[color:var(--muted)] hover:text-[color:var(--text)]"
        >
          ← панель
        </Link>
      </div>
      <h1 className="text-[20px] font-bold text-[color:var(--text)]">Уведомления</h1>
      <p className="mt-1 mb-5 text-[13px] text-[color:var(--muted)]">
        Каталог Telegram-событий: кто получает, когда срабатывает и что нужно настроить.
      </p>
      <AdminNotificationsCatalog />
    </main>
  )
}
