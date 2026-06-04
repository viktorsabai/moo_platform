'use client'

import { usePathname, useRouter } from 'next/navigation'
import { PillTabToggle } from '@/components/ui/PillTabToggle'

const TABS = [
  { id: 'catalog', label: 'каталог', href: '/admin/subscriptions' },
  { id: 'clients', label: 'подписчики', href: '/admin/subscriptions/clients' },
] as const

export function AdminSubscriptionNav() {
  const pathname = usePathname()
  const router = useRouter()
  const active = pathname?.includes('/subscriptions/clients') ? 'clients' : 'catalog'

  return (
    <PillTabToggle
      className="w-full"
      options={TABS.map((t) => ({ id: t.id, label: t.label }))}
      value={active}
      onChange={(id) => {
        const tab = TABS.find((t) => t.id === id)
        if (tab) router.push(tab.href)
      }}
    />
  )
}
