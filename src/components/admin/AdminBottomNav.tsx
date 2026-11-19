'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

type Tab = { href: string; label: string; match: (p: string) => boolean; icon: ReactNode }

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
    {children}
  </svg>
)

const TABS: Tab[] = [
  {
    href: '/admin',
    label: 'заказы',
    match: (p) => p === '/admin' || p.startsWith('/admin/orders'),
    icon: svg(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>),
  },
  {
    href: '/admin/kitchen',
    label: 'кухня',
    match: (p) => p.startsWith('/admin/kitchen'),
    icon: svg(<><path d="M6 13a6 6 0 0 1 12 0v1H6v-1z" /><path d="M4 17h16M12 7V5M10 5h4" /></>),
  },
  {
    href: '/admin/store',
    label: 'меню',
    match: (p) => p.startsWith('/admin/store'),
    icon: svg(<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 4.5-3 7h3v11" />),
  },
  {
    href: '/admin/more',
    label: 'ещё',
    match: (p) =>
      p !== '/admin' && !p.startsWith('/admin/orders') && !p.startsWith('/admin/kitchen') && !p.startsWith('/admin/store'),
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden>
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
      </svg>
    ),
  },
]

export function AdminBottomNav() {
  const pathname = usePathname() || ''
  return (
    <nav
      aria-label="кабинет"
      className="fixed bottom-0 left-0 right-0 z-[200] border-t border-[color:var(--stroke)] bg-[color:var(--bottom-bg)] backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div style={{ ['--ufo-bottomnav-h' as any]: '72px' }} className="mx-auto grid h-[72px] max-w-md grid-cols-4 gap-1 px-2 py-2">
        {TABS.map((t) => {
          const active = t.match(pathname)
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className="flex h-full min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-[0.98]"
            >
              <span className={active ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]'}>{t.icon}</span>
              <span className={active ? 'text-[color:var(--text)]' : 'text-[color:var(--muted)]'}>{t.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
