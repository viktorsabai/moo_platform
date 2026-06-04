'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type RestaurantInfo = {
  id: string
  name: string
  slug: string
  botIntegrations?: Array<{ botUsername?: string | null; startParam: string }>
}

export default function AdminQrPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [botUsername, setBotUsername] = useState('')
  const [botToken, setBotToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/restaurant', { cache: 'no-store', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'не удалось загрузить')
        setRestaurant(null)
        return
      }
      setRestaurant(data.restaurant || null)
      const bot = data.restaurant?.botIntegrations?.[0]
      if (bot?.botUsername) setBotUsername(String(bot.botUsername))
    } catch {
      setError('не удалось загрузить')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const bot = restaurant?.botIntegrations?.[0]
  const link = useMemo(() => {
    if (!bot?.botUsername || !bot?.startParam) return null
    return `https://t.me/${bot.botUsername.replace(/^@/, '')}?startapp=${bot.startParam}`
  }, [bot?.botUsername, bot?.startParam])

  async function saveBot() {
    if (!botUsername.trim()) {
      toast.error('Укажите username бота')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bot', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          botUsername: botUsername.trim().replace(/^@/, ''),
          botToken: botToken.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        toast.success('Сохранено')
        await load()
      } else {
        toast.error(data?.error || 'Ошибка')
      }
    } catch {
      toast.error('Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="ui-container ui-screen !pb-20">
      <div className="mb-4">
        <Link
          href="/admin"
          className="text-[13px] font-medium text-[color:var(--muted)] hover:text-[color:var(--text)]"
        >
          ← панель владельца
        </Link>
      </div>
      {loading ? (
        <Card variant="surfaceStrong" className="p-5 text-[13px] font-semibold text-[color:var(--muted)]">
          загрузка…
        </Card>
      ) : error ? (
        <Card variant="surfaceStrong" className="p-5 text-[13px] font-semibold text-red-400">
          {error}
        </Card>
      ) : !link ? (
        <Card variant="surfaceStrong" className="p-5">
          <div className="text-[14px] font-semibold text-[color:var(--text)]">подключить Telegram‑бота</div>
          <div className="mt-1 text-[13px] font-medium text-[color:var(--muted)]">
            Username бота (без @) — для ссылки и QR. Токен — по желанию, для расширенных функций.
          </div>
          <div className="mt-4 space-y-3">
            <input
              className="input input--pill w-full"
              placeholder="username бота (например MyFoodBot)"
              value={botUsername}
              onChange={(e) => setBotUsername(e.target.value)}
            />
            <input
              className="input input--pill w-full"
              placeholder="токен бота (опционально)"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              type="password"
              autoComplete="off"
            />
            <Button
              type="button"
              onClick={saveBot}
              disabled={saving || !botUsername.trim()}
              className="h-11 w-full rounded-full text-[14px]"
            >
              {saving ? '…' : 'сохранить'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card variant="surfaceStrong" className="p-5">
          {showEdit && (
            <div className="mb-4 rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-4">
              <div className="text-[13px] font-semibold text-[color:var(--text)]">данные бота</div>
              <div className="mt-2 space-y-2">
                <input
                  className="input input--pill w-full"
                  placeholder="username бота"
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                />
                <input
                  className="input input--pill w-full"
                  placeholder="токен (опционально)"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  type="password"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  onClick={saveBot}
                  disabled={saving}
                  className="h-10 rounded-full px-4 text-[13px] font-semibold"
                >
                  {saving ? '…' : 'сохранить'}
                </Button>
              </div>
              {link && (
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="mt-2 text-[12px] text-[color:var(--muted)]"
                >
                  свернуть
                </button>
              )}
            </div>
          )}
          {link && !showEdit && (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="mb-2 text-[12px] font-medium text-[color:var(--primary)]"
            >
              изменить бота
            </button>
          )}
          <div className="text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">ссылка для гостей</div>
          <div className="mt-2 rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 py-3 text-[12px] font-semibold text-[color:var(--text)] break-all">
            {link}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              onClick={() => navigator.clipboard?.writeText(link).catch(() => {})}
              variant="soft"
              className="h-11 w-full rounded-full text-[14px]"
            >
              копировать ссылку
            </Button>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-6 text-[14px] font-semibold text-white transition active:opacity-90"
            >
              открыть в Telegram
            </a>
          </div>

          <div className="mt-5 text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">QR</div>
          <div className="mt-2 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="qr"
              className="h-28 w-28 rounded-[14px] border border-[color:var(--stroke)] bg-white"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`}
            />
            <div className="text-[13px] font-medium text-[color:var(--muted)]">
              распечатай QR и размести у входа/на столах — гость откроет чат с ботом и попадёт в mini app.
            </div>
          </div>
        </Card>
      )}
    </main>
  )
}

