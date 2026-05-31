'use client'

import React, { createContext, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getTipsForRoute } from '@/lib/tips-content'

const TIPS_SEEN_KEY = 'tips_seen_'

type TipsContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
}

const TipsContext = createContext<TipsContextValue>({ open: false, setOpen: () => {} })

export function useTips() {
  return useContext(TipsContext)
}

function TipsFirstVisit() {
  const pathname = usePathname() || ''
  const { setOpen } = useTips()

  const routeId = pathname === '/admin' ? 'admin' : pathname.startsWith('/admin/venue') ? 'admin/venue' : null

  React.useEffect(() => {
    if (!routeId) return
    try {
      const key = TIPS_SEEN_KEY + routeId.replace(/\//g, '_')
      if (localStorage.getItem(key)) return
      setOpen(true)
      localStorage.setItem(key, '1')
    } catch {}
  }, [routeId, setOpen])

  return null
}

function TipsSheetInner() {
  const pathname = usePathname() || ''
  const { open, setOpen } = useTips()
  const card = getTipsForRoute(pathname)
  const [step, setStep] = React.useState(0)

  // При открытии листа сбрасываем шаг
  React.useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null
  if (!card) return null

  const steps = card.body
  const current = steps[step] ?? steps[0]
  const isLast = step >= steps.length - 1

  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        aria-label="закрыть"
        onClick={close}
        className="fixed inset-0 z-[100] bg-black/40"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[101] border-t border-black/10 bg-[color:var(--bottom-bg)] p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        style={{
          borderTopLeftRadius: 'var(--radius-large)',
          borderTopRightRadius: 'var(--radius-large)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        }}
      >
        <div className="ui-h2 mb-2 text-[14px]">{card.title}</div>
        <p className="ui-body mb-4 text-[14px] text-[color:var(--text)]">
          {current}
        </p>
        <div className="flex gap-2">
          {steps.length > 1 && !isLast ? (
            <>
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-full border border-black/15 py-3 text-[14px] font-semibold transition active:opacity-90"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                Пропустить
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="btn btn-primary flex-1 rounded-full py-3 text-[14px] font-semibold transition active:opacity-90"
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                Далее
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={close}
              className="btn btn-primary w-full rounded-full py-3 text-[14px] font-semibold transition active:opacity-90"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              Понятно
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export function TipsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = React.useMemo(() => ({ open, setOpen }), [open])

  return (
    <TipsContext.Provider value={value}>
      {children}
      <TipsFirstVisit />
      <TipsSheetInner />
    </TipsContext.Provider>
  )
}
