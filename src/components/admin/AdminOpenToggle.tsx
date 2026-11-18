'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

export function AdminOpenToggle({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    if (saving) return
    const next = !open
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isOpenOverride: next }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setOpen(next)
        toast.success(next ? 'Приём заказов включён' : 'Приём заказов на паузе')
      } else {
        toast.error(data?.error || 'Не удалось сохранить')
      }
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      aria-label={open ? 'приём заказов включён' : 'приём заказов на паузе'}
      disabled={saving}
      onClick={toggle}
      className="flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] pl-3.5 pr-2 text-[13px] font-semibold text-[color:var(--text)] disabled:opacity-60"
    >
      {open ? 'принимаем' : 'пауза'}
      <span
        className={cn(
          'flex h-6 w-10 shrink-0 items-center rounded-full px-[3px] transition',
          open ? 'justify-end bg-[color:var(--ok)]' : 'justify-start bg-[color:var(--stroke-strong)]'
        )}
      >
        <span className="h-[18px] w-[18px] rounded-full bg-[color:var(--surface-strong)]" />
      </span>
    </button>
  )
}
