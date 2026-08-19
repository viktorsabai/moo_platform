'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { AdminQuickToggle } from '@/components/admin/AdminQuickToggle'

type Settings = {
  menuEnabled: boolean
  storeEnabled: boolean
  subscriptionEnabled: boolean
}

export function OwnerOperationsControls({ initial }: { initial: Settings | null }) {
  const [settings, setSettings] = useState<Settings | null>(initial)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(key: keyof Settings, next: boolean) {
    if (!settings) return
    setSaving(key)
    const previous = settings
    setSettings({ ...settings, [key]: next })
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'не удалось сохранить настройку')
      if (data.settings) setSettings({
        menuEnabled: Boolean(data.settings.menuEnabled),
        storeEnabled: Boolean(data.settings.storeEnabled),
        subscriptionEnabled: Boolean(data.settings.subscriptionEnabled),
      })
      toast.success('настройка сохранена')
    } catch (error) {
      setSettings(previous)
      toast.error(error instanceof Error ? error.message : 'не удалось сохранить настройку')
    } finally {
      setSaving(null)
    }
  }

  if (!settings) return null

  return (
    <section className="rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--muted)]">быстрые режимы</p>
          <h2 className="mt-1 text-[17px] font-black text-[color:var(--text)]">Что сейчас видит гость</h2>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-[color:var(--muted)]">Обратимые переключатели для ежедневной работы. Детальные правила — в настройках.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800">live</span>
      </div>
      <div className="mt-3">
        <AdminQuickToggle label="витрина опубликована" hint="гость может открыть заведение" checked={settings.storeEnabled} disabled={saving !== null} onChange={(next) => void toggle('storeEnabled', next)} />
        <AdminQuickToggle label="меню доступно" hint="блюда можно просматривать и заказывать" checked={settings.menuEnabled} disabled={saving !== null} onChange={(next) => void toggle('menuEnabled', next)} />
        <AdminQuickToggle label="принимаем подписки" hint="гость может отправить новый рацион" checked={settings.subscriptionEnabled} disabled={saving !== null} onChange={(next) => void toggle('subscriptionEnabled', next)} />
      </div>
    </section>
  )
}
