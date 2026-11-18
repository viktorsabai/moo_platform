'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Screen, Card, Btn } from '@/components/kit'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useVenue } from '@/lib/venue-context'

type Bot = { id: string; botUsername?: string | null; startParam: string }
type Restaurant = { id: string; name: string; slug: string; isActive: boolean; botIntegrations: Bot[] }

export default function PlatformPage() {
  const { restaurantId: activeRestaurantId } = useVenue()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [newStartParam, setNewStartParam] = useState('')
  const [ownerTelegramId, setOwnerTelegramId] = useState('')

  const [botRestaurantId, setBotRestaurantId] = useState('')
  const [botUsername, setBotUsername] = useState('')
  const [startParam, setStartParam] = useState('')
  const [botToken, setBotToken] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/restaurants', { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'нет доступа')
        setRestaurants([])
        return
      }
      setRestaurants(Array.isArray(data.restaurants) ? data.restaurants : [])
      if (!botRestaurantId && Array.isArray(data.restaurants) && data.restaurants[0]?.id) {
        setBotRestaurantId(data.restaurants[0].id)
      }
    } catch {
      setError('ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canCreateRestaurant = useMemo(() => Boolean(name.trim() && slug.trim()), [name, slug])
  const canCreateBot = useMemo(() => Boolean(botRestaurantId && startParam.trim()), [botRestaurantId, startParam])

  async function createRestaurant() {
    if (!canCreateRestaurant) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/restaurants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          startParam: (newStartParam || slug).trim(),
          botUsername: botUsername.trim() || null,
          botToken: botToken.trim() || null,
          ownerTelegramId: ownerTelegramId.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'ошибка')
        return
      }
      setName('')
      setSlug('')
      setNewStartParam('')
      setOwnerTelegramId('')
      await load()
    } catch {
      setError('ошибка')
    } finally {
      setLoading(false)
    }
  }

  async function switchRestaurant(restaurantId: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'ошибка')
        return
      }
      window.location.href = '/admin'
    } catch {
      setError('ошибка')
    } finally {
      setLoading(false)
    }
  }

  async function createBot() {
    if (!canCreateBot) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/bots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          restaurantId: botRestaurantId,
          botUsername: botUsername.trim() || null,
          startParam: startParam.trim(),
          botToken: botToken.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'ошибка')
        return
      }
      setBotUsername('')
      setStartParam('')
      setBotToken('')
      await load()
    } catch {
      setError('ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen back="/profile" title="платформа" subtitle="подключение заведений и Telegram‑ботов">
      {error ? (
        <Card className="mb-4">
          <div className="text-[13px] font-semibold text-[color:var(--danger)]">{String(error)}</div>
        </Card>
      ) : null}

      {/* create restaurant */}
      <Card>
        <div className="text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">добавить заведение</div>
        <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
          шаги: заведение → бот → QR. владелец дальше управляет внутри “управление заведением”.
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className="input input--pill" placeholder="название" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input input--pill" placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <input
            className="input input--pill"
            placeholder="код запуска (по умолчанию = slug)"
            value={newStartParam}
            onChange={(e) => setNewStartParam(e.target.value)}
          />
          <input
            className="input input--pill"
            placeholder="telegram id владельца (опционально)"
            value={ownerTelegramId}
            onChange={(e) => setOwnerTelegramId(e.target.value)}
            inputMode="numeric"
          />
          <input className="input input--pill" placeholder="username бота (опционально)" value={botUsername} onChange={(e) => setBotUsername(e.target.value)} />
          <input className="input input--pill" placeholder="token бота (опционально)" value={botToken} onChange={(e) => setBotToken(e.target.value)} />
          <Btn full onClick={createRestaurant} disabled={!canCreateRestaurant || loading}>
            создать
          </Btn>
        </div>
      </Card>

      {/* connect bot */}
      <Card className="mt-4">
        <div className="text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">подключить бота</div>
        <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
          токен берётся в @BotFather. username нужен, чтобы собрать ссылку и QR для гостей.
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CustomSelect
            value={botRestaurantId}
            onChange={setBotRestaurantId}
            placeholder="выбери заведение"
            options={restaurants.map((r) => ({ value: r.id, label: `${r.name} (${r.slug})` }))}
          />
          <input className="input input--pill" placeholder="код запуска (уникальный)" value={startParam} onChange={(e) => setStartParam(e.target.value)} />
          <input className="input input--pill" placeholder="username бота" value={botUsername} onChange={(e) => setBotUsername(e.target.value)} />
          <input className="input input--pill" placeholder="token бота" value={botToken} onChange={(e) => setBotToken(e.target.value)} />
        </div>
        <Btn full className="mt-3" onClick={createBot} disabled={!canCreateBot || loading}>
          сохранить
        </Btn>
        <div className="mt-2 text-[12px] font-semibold text-[color:var(--muted)]">
          “код запуска” — это `startapp=...` в ссылке/QR. По нему mini app понимает, какое заведение открыто.
        </div>
      </Card>

      {/* list */}
      <div className="mt-5">
        <div className="mb-2 text-[13px] font-extrabold tracking-tight text-[color:var(--text)]">заведения</div>
        {activeRestaurantId ? (
          <div className="mb-2 text-[12px] font-semibold text-[color:var(--muted)]">
            активное заведение:{' '}
            <span className="font-extrabold text-[color:var(--text)]">
              {restaurants.find((r) => r.id === activeRestaurantId)?.name || activeRestaurantId}
            </span>
          </div>
        ) : null}
        {loading ? (
          <Card className="p-5">
            <div className="text-[13px] font-semibold text-[color:var(--muted)]">загрузка…</div>
          </Card>
        ) : (
          <div className="divide-y divide-[color:var(--stroke)]">
            {restaurants.map((r) => (
              <div key={r.id} className="px-1 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[color:var(--text)]">
                      {r.name}
                      {activeRestaurantId === r.id ? (
                        <span className="ml-2 rounded-full border border-[color:var(--stroke)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                          активно
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[12px] font-semibold text-[color:var(--muted)]">
                      {r.slug} · {r.isActive ? 'active' : 'disabled'} · id {r.id}
                    </div>
                    {r.botIntegrations?.length ? (
                      <div className="mt-2 space-y-2">
                        {r.botIntegrations.map((b) => {
                          const link = b.botUsername ? `https://t.me/${b.botUsername}?startapp=${b.startParam}` : null
                          return (
                            <div key={b.id} className="rounded-[14px] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
                              <div className="text-[12px] font-semibold text-[color:var(--muted)]">
                                bot: {b.botUsername || '—'} · startapp={b.startParam}
                              </div>
                              {link ? (
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                                  <a className="text-[12px] font-semibold text-[color:var(--primary)] break-all" href={link} target="_blank" rel="noreferrer">
                                    {link}
                                  </a>
                                  <Btn
                                    variant="secondary"
                                    className="h-9 px-4 text-[12px]"
                                    onClick={() => navigator.clipboard?.writeText(link).catch(() => {})}
                                  >
                                    копировать
                                  </Btn>
                                </div>
                              ) : (
                                <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                                  добавь bot username — появится готовый deeplink для QR
                                </div>
                              )}
                              {link ? (
                                <div className="mt-3 flex items-start gap-3">
                                  <img
                                    alt="qr"
                                    className="h-24 w-24 rounded-[12px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]"
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}`}
                                  />
                                  <div className="text-[12px] font-semibold text-[color:var(--muted)]">
                                    это QR на вход в бота/mini app. распечатай — и пользователь всегда попадёт в правильное заведение.
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="mt-2 text-[12px] font-semibold text-[color:var(--muted)]">бот не привязан</div>
                    )}
                  </div>
                  <Btn
                    variant="secondary"
                    className="h-9 shrink-0 px-4 text-[12px]"
                    onClick={() => switchRestaurant(r.id)}
                    disabled={loading}
                  >
                    {activeRestaurantId === r.id ? 'текущее' : 'войти как'}
                  </Btn>
                </div>
              </div>
            ))}
            {!restaurants.length ? (
              <div className="px-1 py-5 text-center text-[13px] font-semibold text-[color:var(--muted)]">пока пусто</div>
            ) : null}
          </div>
        )}
      </div>
    </Screen>
  )
}

