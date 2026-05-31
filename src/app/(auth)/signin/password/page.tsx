'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { PageHeader } from '@/components/ui/PageHeader'
import { BackLink } from '@/components/ui/BackLink'

export default function SignInPasswordPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedLogin = login.trim()
    if (!trimmedLogin || !password) {
      setError('Введите логин и пароль')
      return
    }
    setLoading(true)
    try {
      const res = await signIn('owner', {
        login: trimmedLogin,
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Неверный логин или пароль')
        setLoading(false)
        return
      }
      if (res?.ok) {
        router.replace('/profile')
        return
      }
      setError('Не удалось войти')
    } catch {
      setError('Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[420px] px-4 pt-5 pb-28">
      <PageHeader backHref="/signin" title="Войти с паролем" subtitle="Логин — ваш Telegram ID. Пароль задаётся в профиле в mini app." className="mb-5" />

      <section className="rounded-[18px] border border-black/10 bg-white/70 p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Логин (ваш Telegram ID)</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="username"
              className="input input--pill w-full"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="например 123456789"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Пароль</label>
            <input
              type="password"
              autoComplete="current-password"
              className="input input--pill w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="пароль из профиля"
            />
          </div>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <p className="text-[12px] text-black/50">
            Забыли пароль? Откройте приложение в Telegram и задайте новый пароль в профиле.
          </p>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--accent)] px-6 text-[13px] font-semibold text-white shadow-[0_12px_26px_rgba(0,0,0,0.14)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <div className="mt-4 flex justify-center">
          <BackLink href="/signin" label="к входу" />
        </div>
      </section>
    </main>
  )
}
