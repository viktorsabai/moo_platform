import Link from 'next/link'

type Row = { href: string; label: string; hint?: string }
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'рационы',
    rows: [
      { href: '/admin/subscriptions/clients', label: 'заявки и подписчики', hint: 'подтверждения, кухня на сегодня' },
      { href: '/admin/subscriptions', label: 'планы и цены', hint: 'маржа, выгода гостя' },
      { href: '/admin/subscription-leads', label: 'запросы «хочу подписку»' },
    ],
  },
  {
    title: 'доставка и оплата',
    rows: [
      { href: '/admin/venue', label: 'часы, зоны доставки, оплата' },
      { href: '/admin/qr', label: 'Telegram-бот и QR' },
    ],
  },
  {
    title: 'гости',
    rows: [
      { href: '/admin/leads', label: 'кейтеринг и события' },
      { href: '/admin/notifications', label: 'уведомления' },
      { href: '/admin/banners', label: 'баннеры и промокоды' },
    ],
  },
  {
    title: 'ресторан',
    rows: [
      { href: '/admin/team', label: 'команда и доступы' },
      { href: '/admin/settings', label: 'настройки' },
      { href: '/admin/setup', label: 'первичная настройка' },
    ],
  },
  { title: 'аналитика', rows: [{ href: '/admin/visits', label: 'посещаемость и корзины' }] },
]

export default function AdminMorePage() {
  return (
    <main className="ui-container ui-screen !pb-24 min-w-0 max-w-full overflow-x-hidden">
      <h1 className="mb-3 text-[22px] font-bold tracking-tight text-[color:var(--text)]">ещё</h1>
      <Link
        href="/"
        prefetch={false}
        className="mb-5 flex h-14 items-center justify-between rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-4 text-[15px] font-semibold text-[color:var(--text)]"
      >
        посмотреть как гость
        <span aria-hidden>›</span>
      </Link>
      <div className="flex flex-col gap-4">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <div className="mb-1.5 px-1 text-[12.5px] font-semibold text-[color:var(--muted)]">{g.title}</div>
            <div className="overflow-hidden rounded-[20px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]">
              {g.rows.map((r, i) => (
                <Link
                  key={r.href}
                  href={r.href}
                  prefetch={false}
                  className={`flex min-h-[52px] items-center justify-between gap-3 px-4 py-2 text-[15px] text-[color:var(--text)] ${i > 0 ? 'border-t border-[color:var(--stroke)]' : ''}`}
                >
                  <span>
                    {r.label}
                    {r.hint ? <span className="block text-[12.5px] text-[color:var(--muted)]">{r.hint}</span> : null}
                  </span>
                  <span aria-hidden className="text-[color:var(--muted)]">›</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <Link href="/profile" prefetch={false} className="py-3 text-center text-[14px] font-semibold text-[color:var(--muted)]">
          в профиль
        </Link>
      </div>
    </main>
  )
}
