'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminSignInPage() {
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
      const res = await signIn('admin', {
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
        router.replace('/admin')
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
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[400px] flex-col justify-center px-4 py-12">
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold tracking-tight text-black/90">Вход в кабинет</h1>
        <p className="mt-1 text-[13px] text-black/50">
          Логин и пароль администратора (ADMIN_LOGIN / ADMIN_PASSWORD)
        </p>
      </div>
      <section className="rounded-[18px] border border-black/10 bg-white/80 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-black/70">Логин</label>
            <input
              type="text"
              autoComplete="username"
              className="input input--pill w-full"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin"
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
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full rounded-full py-3 text-[14px] font-semibold disabled:opacity-60"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
        <p className="mt-4 text-center text-[12px] text-black/40">
          <Link href="/profile" className="underline-offset-2 hover:underline">
            Назад в профиль
          </Link>
          {' · '}
          <Link href="/signin/password" className="underline-offset-2 hover:underline">
            Вход владельца (Telegram ID)
          </Link>
        </p>
      </section>
    </main>
  )
}
