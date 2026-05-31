'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

type Settings = {
  deliveryFee: number
  freeDeliveryFrom: number
  isOpenOverride: boolean | null
}

export function AdminQuickSettings({ initial }: { initial: Settings }) {
  const [override, setOverride] = useState<boolean | null>(initial.isOpenOverride)
  const [loading, setLoading] = useState(false)

  async function saveOpenOverride(next: boolean) {
    setOverride(next)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isOpenOverride: next }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setOverride(override)
        toast.error(data?.error || 'Не удалось сохранить')
      }
    } catch {
      setOverride(override)
      toast.error('Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="overflow-hidden border border-black/[0.06] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]"
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      <h2 className="ui-h2 mb-3 text-[14px]">быстро</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="ui-body text-[13px] font-medium">принудительно</span>
          <div className="flex gap-1 rounded-full border border-black/10 bg-black/[0.04] p-0.5" style={{ borderRadius: 'var(--radius-pill)' }}>
            <button
              type="button"
              onClick={() => override !== false && saveOpenOverride(false)}
              disabled={loading}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.98] disabled:opacity-50',
                override === false ? 'bg-[color:var(--text)] text-white' : 'text-black/60'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              закрыто
            </button>
            <button
              type="button"
              onClick={() => override !== true && saveOpenOverride(true)}
              disabled={loading}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.98] disabled:opacity-50',
                override === true ? 'bg-[color:var(--text)] text-white' : 'text-black/60'
              )}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              открыто
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
