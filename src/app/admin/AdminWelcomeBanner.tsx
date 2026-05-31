'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'admin_welcome_seen'

export function AdminWelcomeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
      setVisible(true)
    } catch {
      setVisible(false)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="mb-4 overflow-hidden border border-black/[0.08] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-soft)]"
      style={{ borderRadius: 'var(--radius-large)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="ui-body min-w-0 flex-1 text-[13px] text-[color:var(--text)]">
          Добро пожаловать в кабинет. Начните с{' '}
          <Link
            href="/admin/venue"
            prefetch={false}
            scroll={false}
            className="font-semibold text-[color:var(--primary)] underline underline-offset-2 transition active:opacity-80"
          >
            настройки заведения
          </Link>
          , затем перейдите в товары и подключите бота для QR.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-black/50 transition active:opacity-80 hover:bg-black/[0.06]"
          aria-label="Закрыть"
        >
          <span className="text-[18px] leading-none">×</span>
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 w-full rounded-full border border-black/10 py-2.5 text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-90"
        style={{ borderRadius: 'var(--radius-pill)' }}
      >
        Понятно
      </button>
    </div>
  )
}
