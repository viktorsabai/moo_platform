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
      <div className="mb-4">
        <h1 className="ui-h1 text-[20px]">Меню и товары</h1>
        <p className="ui-muted mt-1 text-[13px]">готовые блюда и товары магазина</p>
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
