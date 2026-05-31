'use client'

import type { Session } from 'next-auth'
import { SessionProvider, useSession, signIn } from 'next-auth/react'
import { VenueProvider } from '@/lib/venue-context'
import { DynamicTitle } from '@/components/DynamicTitle'
import { ActivityTracker } from '@/components/ActivityTracker'
import { useEffect, useRef } from 'react'
import { Toaster } from 'react-hot-toast'
function ClientErrorReporter() {
  useEffect(() => {
    let sent = 0
    const send = (payload: any) => {
      if (sent >= 5) return
      sent += 1
      try {
        void fetch('/api/client-error', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            href: typeof location !== 'undefined' ? location.href : undefined,
            ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            ts: Date.now(),
          }),
          keepalive: true,
        })
      } catch {}
    }

    const onError = (event: ErrorEvent) => {
      send({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: (event.error as any)?.stack,
      })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      send({
        type: 'unhandledrejection',
        message: typeof reason === 'string' ? reason : reason?.message,
        stack: reason?.stack,
        reason,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}

function TelegramAutoLogin() {
  const { data: session, status } = useSession()
  const inFlightRef = useRef(false)
  const hasValidUserId = Boolean((session?.user as any)?.id)

  useEffect(() => {
    if (status === 'authenticated' && hasValidUserId) return

    const w = globalThis as any
    const tg = w?.Telegram?.WebApp

    // make sure webapp is initialized and expanded
    try {
      tg?.ready?.()
      tg?.expand?.()
    } catch {}

    const initData = tg?.initData as string | undefined
    if (!initData) return

    // persist tg user for UI (header/profile)
    try {
      const u = tg?.initDataUnsafe?.user
      if (u?.id) {
        const normalized = {
          id: u.id,
          username: u.username,
          first_name: u.first_name,
          last_name: u.last_name,
          photo_url: u.photo_url,
        }
        localStorage.setItem('tg_user', JSON.stringify(normalized))
      }
    } catch {}

    // silent auto-login inside telegram web app
    let cancelled = false
    const run = async () => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      const attempts = [0, 300, 1200]
      try {
        for (const delayMs of attempts) {
          if (cancelled) return
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
          try {
            // set venue cookie early (important for desktop Telegram Web + iframe cookie policies)
            await fetch('/api/venue/init', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ initData }),
            }).catch(() => null)
            const res = await signIn('telegram', { initData, redirect: false, callbackUrl: '/' })
            if ((res as any)?.ok) return
          } catch {
            // ignore and retry
          }
        }
      } finally {
        inFlightRef.current = false
      }
    }
    void run()
    return () => {
      cancelled = true
      inFlightRef.current = false
    }
  }, [hasValidUserId, status])

  useEffect(() => {
    try {
      const tg = (globalThis as any)?.Telegram?.WebApp
      const u = tg?.initDataUnsafe?.user
      if (u?.id) {
        const normalized = {
          id: u.id,
          username: u.username,
          first_name: u.first_name,
          last_name: u.last_name,
          photo_url: u.photo_url,
        }
        localStorage.setItem('tg_user', JSON.stringify(normalized))
      }
    } catch {}
  }, [status])

  return null
}

function ScrollHideFloatingBars() {
  useEffect(() => {
    let lastY = 0
    let ticking = false

    const getEl = () => document.querySelector('[data-scroll-hide]') as HTMLElement | null

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const el = getEl()
        const y = window.scrollY || 0
        if (el) {
          if (y > lastY + 2) el.classList.add('is-hidden')
          else if (y < lastY - 2) el.classList.remove('is-hidden')
        }
        lastY = y
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return null
}

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode
  session?: Session | null
}) {
  return (
    <SessionProvider session={session ?? undefined}>
      <VenueProvider>
        <DynamicTitle />
        <ClientErrorReporter />
        <TelegramAutoLogin />
        <ActivityTracker />
        <ScrollHideFloatingBars />
        <div className="min-h-screen pb-20">{children}</div>
        <Toaster
          position="top-center"
          containerStyle={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            inset: 'auto',
            zIndex: 99999,
          }}
          toastOptions={{
            duration: 3200,
            style: {
              background: 'var(--surface-strong)',
              color: 'var(--text)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-large)',
              boxShadow: 'var(--shadow-card)',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 500,
              maxWidth: 'min(90vw, 360px)',
            },
            success: {
              iconTheme: { primary: 'var(--primary)', secondary: 'white' },
            },
            error: {
              style: {
                background: 'var(--surface-strong)',
                borderColor: 'rgba(220, 38, 38, 0.3)',
                color: 'var(--text)',
              },
              iconTheme: { primary: '#dc2626', secondary: 'white' },
            },
          }}
        />
      </VenueProvider>
    </SessionProvider>
  )
}
