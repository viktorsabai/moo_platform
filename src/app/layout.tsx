import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { HeaderCompact } from '@/components/layout/HeaderCompact'
import Script from 'next/script'
import BottomNavbar from '@/components/bottom-navbar'
import { StickyCartBar } from '@/components/StickyCartBar'
import { ScrollToTopOnRoute } from '@/components/ScrollToTopOnRoute'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

/** Safe session for RSC → client: only plain serializable fields to avoid RSC payload errors */
function toSerializableSession(s: Session | null): Session | null {
  if (!s || typeof s !== 'object') return null
  try {
    const u = s.user
    const out: Record<string, unknown> = {
      expires: typeof (s as any).expires === 'string' ? (s as any).expires : '',
      user: {
        id: typeof (u as any)?.id === 'string' ? (u as any).id : '',
        name: (u as any)?.name ?? null,
        email: (u as any)?.email ?? null,
        image: (u as any)?.image ?? null,
        telegramId: (u as any)?.telegramId ?? undefined,
        role: (u as any)?.role ?? undefined,
        platformRole: (u as any)?.platformRole ?? undefined,
        memberRole: (u as any)?.memberRole ?? undefined,
      },
    }
    if (typeof (s as any).restaurantId === 'string') out.restaurantId = (s as any).restaurantId
    return out as unknown as Session
  } catch {
    return null
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'UFO Delivery - Доставка еды с подпиской',
  description: 'Заказывайте еду и подписывайтесь на регулярные доставки',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let session: Session | null = null
  try {
    const s = await getServerSession(authOptions).then(
      (v) => (v && typeof v === 'object' ? (v as Session) : null)
    ).catch(() => null)
    session = toSerializableSession(s)
  } catch {
    session = null
  }

  let body: React.ReactNode
  try {
    body = (
      <>
        <Providers session={session}>
          <ScrollToTopOnRoute />
          <div
            className="ufo-shell"
            style={{
              ['--ufo-header-h' as any]: '56px',
              ['--ufo-bottomnav-h' as any]: '72px',
              /* extra scroll pad so last content clears floating summary/CTA (outer main already reserves tab bar + safe) */
              ['--ufo-scroll-pad-floating' as any]: 'calc(5.75rem + 12px)',
            }}
          >
            <HeaderCompact />

            <main
              className="ufo-main"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top) + var(--ufo-header-h))',
                paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--ufo-bottomnav-h) + 8px)',
              }}
            >
              <div className="w-full">{children}</div>
              <StickyCartBar />
            </main>

            <BottomNavbar />
          </div>
        </Providers>
      </>
    )
  } catch {
    body = (
      <Providers session={null}>
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-[14px] text-black/60">Ошибка загрузки. Попробуйте обновить страницу.</p>
        </div>
      </Providers>
    )
  }

  return (
    <html lang="ru">
      <body
        className={`ufo-app`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Script
          id="ufo-webapp-init"
          strategy="beforeInteractive"
        >{`
          (function () {
            try {
              var storedTheme = localStorage.getItem('ufo_theme') || 'system';
              var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              var useDark = storedTheme === 'dark' || (storedTheme === 'system' && prefersDark);
              if (useDark) document.documentElement.classList.add('dark');
              else document.documentElement.classList.remove('dark');
            } catch (e) {}

            try {
              var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
              if (mq && typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', function () {
                  try {
                    var t = localStorage.getItem('ufo_theme') || 'system';
                    if (t !== 'system') return;
                    document.documentElement.classList.toggle('dark', mq.matches);
                  } catch (e) {}
                });
              }
            } catch (e) {}

            try {
              var tg = window.Telegram && window.Telegram.WebApp;
              if (tg) {
                tg.ready();
                tg.expand();
                if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
              }
            } catch (e) {}

            // prevent iOS pinch-zoom in Telegram/Safari webviews
            try {
              document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
              document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
              document.addEventListener('gestureend', function (e) { e.preventDefault(); }, { passive: false });
            } catch (e) {}

            // Telegram WebView sometimes serves stale Next.js chunks after deploys.
            // If a dynamic import / chunk load fails, force a single hard reload.
            try {
              var didReload = false;
              var markReload = function () {
                if (didReload) return false;
                didReload = true;
                return true;
              };

              var isChunkError = function (err, message) {
                var msg = String(message || (err && err.message) || '');
                var name = String((err && err.name) || '');
                return (
                  name === 'ChunkLoadError' ||
                  msg.indexOf('ChunkLoadError') >= 0 ||
                  msg.indexOf('Loading chunk') >= 0 ||
                  msg.indexOf('Failed to fetch dynamically imported module') >= 0 ||
                  msg.indexOf('Importing a module script failed') >= 0
                );
              };

              var report = function (payload) {
                try {
                  var body = JSON.stringify(payload);
                  if (navigator && typeof navigator.sendBeacon === 'function') {
                    navigator.sendBeacon('/api/client-error', body);
                    return;
                  }
                  fetch('/api/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true });
                } catch (e) {}
              };

              window.addEventListener('error', function (event) {
                try {
                  if (!isChunkError(event && event.error, event && event.message)) return;
                  report({ type: 'chunk_error', message: event && event.message, href: location && location.href, ts: Date.now() });
                  if (markReload()) location.reload();
                } catch (e) {}
              });

              window.addEventListener('unhandledrejection', function (event) {
                try {
                  var reason = event && event.reason;
                  if (!isChunkError(reason, reason && reason.message)) return;
                  report({ type: 'chunk_rejection', message: reason && reason.message, href: location && location.href, ts: Date.now() });
                  if (markReload()) location.reload();
                } catch (e) {}
              });
            } catch (e) {}
          })();
        `}</Script>
        {body}
      </body>
    </html>
  )
}
