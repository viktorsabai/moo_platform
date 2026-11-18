'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Screen, Card, Btn } from '@/components/kit'

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
    <Screen back="/signin" title="Войти с паролем" subtitle="Логин — ваш Telegram ID. Пароль задаётся в профиле в mini app.">
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">Логин (ваш Telegram ID)</label>
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
            <label className="mb-1 block text-[12px] font-semibold text-[color:var(--muted)]">Пароль</label>
            <input
              type="password"
              autoComplete="current-password"
              className="input input--pill w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="пароль из профиля"
            />
          </div>
          {error && <p className="text-[13px] text-[color:var(--danger)]">{error}</p>}
          <p className="text-[12px] text-[color:var(--muted)]">
            Забыли пароль? Откройте приложение в Telegram и задайте новый пароль в профиле.
          </p>
          <Btn type="submit" full size="lg" disabled={loading} className="mt-2">
            {loading ? 'Вход…' : 'Войти'}
          </Btn>
        </form>

        <div className="mt-4 flex justify-center">
          <Link href="/signin" className="text-[13px] font-semibold text-[color:var(--muted)] underline underline-offset-2">
            к входу
          </Link>
        </div>
      </Card>
    </Screen>
  )
}
