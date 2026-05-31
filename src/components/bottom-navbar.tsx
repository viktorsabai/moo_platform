'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: (props: { className?: string }) => ReactNode
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9.5" />
    </svg>
  )
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  )
}

function IconRepeat({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 21a8 8 0 1 0-16 0" />
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  )
}

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

const ALL_ITEMS: NavItem[] = [
  { href: '/', label: 'главная', icon: (p) => <IconHome {...p} /> },
  { href: '/menu', label: 'доставка', icon: (p) => <IconMenu {...p} /> },
  { href: '/subscriptions', label: 'подписка', icon: (p) => <IconRepeat {...p} /> },
  { href: '/profile', label: 'профиль', icon: (p) => <IconUser {...p} /> },
]

function isOwnerContext(pathname: string) {
  return pathname.startsWith('/admin') || pathname === '/profile/owner'
}

export default function BottomNavbar() {
  const pathname = usePathname() || ''
  const inOwnerContext = isOwnerContext(pathname)
  const items = ALL_ITEMS

  if (inOwnerContext) {
    return (
      <nav
        aria-label="owner"
        className="fixed bottom-0 left-0 right-0 z-[200] border-t border-[color:var(--stroke)] bg-[color:var(--bottom-bg)] backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          style={{ ['--ufo-bottomnav-h' as any]: '72px' }}
          className="mx-auto max-w-md px-4 py-3"
        >
          <Link
            href="/profile"
            prefetch={false}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-80"
            style={{ borderRadius: 'var(--radius-pill)' }}
            aria-label="назад в профиль"
          >
            <IconArrowLeft className="h-5 w-5 shrink-0" />
            профиль
          </Link>
        </div>
      </nav>
    )
  }

  return (
    <>
      <nav
        aria-label="primary"
        className="fixed bottom-0 left-0 right-0 z-[200] border-t border-[color:var(--stroke)] bg-[color:var(--bottom-bg)] backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          style={{ ['--bottom-nav-h' as any]: 'var(--ufo-bottomnav-h,72px)' }}
          className="mx-auto max-w-md px-2"
        >
          <div
            className="grid h-[var(--bottom-nav-h)] gap-1 py-2"
            style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
          >
            {items.map((it) => {
              const active = pathname === it.href || (it.href !== '/' && pathname.startsWith(it.href))
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  prefetch={false}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-full flex-col items-center justify-center gap-1 px-2 text-[11px] font-semibold transition active:scale-[0.98]"
                >
                  <span
                    className={
                      active
                        ? 'leading-none text-[color:var(--accent)] transition-transform duration-150 ease-out scale-[1.04]'
                        : 'leading-none text-[color:var(--muted)] opacity-90'
                    }
                  >
                    {it.icon({ className: 'h-5 w-5' })}
                  </span>
                  <span className={active ? 'leading-none text-[color:var(--text)]' : 'leading-none text-[color:var(--muted)]'}>
                    {it.label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}