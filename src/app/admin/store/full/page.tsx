'use client'

import { useEffect, useState } from 'react'
import { AdminMenuTab } from '@/app/admin/AdminMenuTab'
import { AdminStoreTab } from '@/app/admin/AdminStoreTab'
import { PillTabToggle } from '@/components/ui/PillTabToggle'

type TabId = 'menu' | 'store'

export default function AdminStorePage() {
  const [tab, setTab] = useState<TabId>('menu')
  const [settings, setSettings] = useState<{ menuEnabled: boolean; storeEnabled: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data?.settings) {
          setSettings({
            menuEnabled: Boolean(data.settings.menuEnabled),
            storeEnabled: Boolean(data.settings.storeEnabled),
          })
        } else {
          setSettings({ menuEnabled: false, storeEnabled: true })
        }
      })
      .catch(() => setSettings({ menuEnabled: false, storeEnabled: true }))
  }, [])

  const tabs = [
    { id: 'menu' as TabId, label: 'Готовые блюда' },
    { id: 'store' as TabId, label: 'Магазин' },
  ]

  return (
    <main className="ui-container ui-screen min-w-0 max-w-full overflow-x-hidden">
      <div className="mb-4 flex items-center gap-1">
        <a href="/admin/store" aria-label="назад" className="-ml-2 flex h-11 w-11 items-center justify-center text-[color:var(--text)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </a>
        <div>
          <h1 className="text-[18px] font-bold text-[color:var(--text)]">полный редактор</h1>
          <p className="text-[12.5px] text-[color:var(--muted)]">категории, опции, импорт, товары магазина</p>
        </div>
      </div>

      <div className="mb-4">
        <PillTabToggle options={tabs} value={tab} onChange={(v) => setTab(v as TabId)} />
      </div>

      {tab === 'menu' && (
        <AdminMenuTab menuEnabled={settings?.menuEnabled ?? false} />
      )}
      {tab === 'store' && (
        <AdminStoreTab storeEnabled={settings?.storeEnabled ?? true} />
      )}
    </main>
  )
}
