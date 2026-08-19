import Link from 'next/link'
import { NotificationPreferencesPanel } from '@/components/notifications/NotificationPreferencesPanel'

export default function ProfileNotificationsPage() {
  return (
    <main className="ui-container ui-screen max-w-full overflow-x-hidden !pb-32">
      <div className="mb-4">
        <Link href="/profile" prefetch={false} className="text-[13px] font-bold text-[color:var(--muted)]">← профиль</Link>
      </div>
      <h1 className="text-[22px] font-extrabold">уведомления</h1>
      <p className="mt-1 mb-5 text-[13px] text-[color:var(--muted)]">Управление сообщениями от бота заведения.</p>
      <NotificationPreferencesPanel />
    </main>
  )
}
