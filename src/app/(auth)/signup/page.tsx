'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { getDemoBotLink } from '@/lib/telegram'

export default function SignUpPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const tmeLink = useMemo(() => getDemoBotLink().tme, [])

  useEffect(() => {
    if (session?.user) {
      router.replace('/')
      return
    }
    const w = window as any
    if (Boolean(w?.Telegram?.WebApp)) {
      router.replace('/')
      return
    }
    if (tmeLink) {
      window.location.href = tmeLink
      return
    }
  }, [router, session?.user, tmeLink])

  return (
    <main className="mx-auto w-full max-w-[420px] px-4 pt-5 pb-28">
      <div className="mb-5">
        <div className="text-[22px] font-extrabold tracking-tight text-black/90">MOO</div>
        <div className="mt-1 text-[13px] font-medium text-black/45">Приложение работает в Telegram</div>
      </div>
      <section className="rounded-[18px] border border-black/10 bg-white/70 p-4">
        <div className="text-[15px] font-semibold text-black/85">Откройте приложение в Telegram</div>
        <p className="mt-1 text-[13px] text-black/45">Аккаунт создаётся автоматически при первом открытии.</p>
        {tmeLink && (
          <a
            href={tmeLink}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--accent)] px-6 text-[13px] font-semibold text-white shadow-[0_12px_26px_rgba(0,0,0,0.14)] transition active:scale-[0.98]"
          >
            Открыть в Telegram
          </a>
        )}
        <Link href="/" prefetch={false} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-black/10 bg-transparent px-6 text-[13px] font-semibold text-black/70">
          На главную
        </Link>
      </section>
      <div className="mt-4 text-center text-[12px] font-medium text-black/40">
        <Link href="/privacy" className="underline-offset-2 hover:underline">Политика конфиденциальности</Link>
      </div>
    </main>
  )
}
