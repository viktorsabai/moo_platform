'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconTrash } from '@/components/ui/icons'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { useVenue } from '@/lib/venue-context'

type FavoriteRow = {
  dishId: string
  dish: {
    id: string
    name: string
    description?: string | null
    price: number
    image?: string | null
    isAvailable: boolean
    category?: { name?: string | null } | null
  }
}

function readTelegramInitData() {
  if (typeof window === 'undefined') return ''
  try {
    return String((window as any)?.Telegram?.WebApp?.initData || '')
  } catch {
    return ''
  }
}

function readTelegramUserId() {
  if (typeof window === 'undefined') return ''
  try {
    const fromUnsafe = String((window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim()
    if (fromUnsafe) return fromUnsafe
  } catch {
    // ignore
  }
  try {
    const initData = String((window as any)?.Telegram?.WebApp?.initData || '')
    if (initData) {
      const rawUser = new URLSearchParams(initData).get('user')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        const fromInitData = String(parsed?.id || '').trim()
        if (fromInitData) return fromInitData
      }
    }
  } catch {
    // ignore
  }
  return ''
}

function readTelegramStartParam() {
  if (typeof window === 'undefined') return ''
  try {
    const fromUnsafe = String((window as any)?.Telegram?.WebApp?.initDataUnsafe?.start_param || '').trim()
    if (fromUnsafe) return fromUnsafe
  } catch {
    // ignore
  }
  try {
    const initData = String((window as any)?.Telegram?.WebApp?.initData || '')
    if (!initData) return ''
    return String(new URLSearchParams(initData).get('start_param') || '').trim()
  } catch {
    return ''
  }
}

export default function ProfileFavoritesPage() {
  const { restaurantId: venueRestaurantId } = useVenue()
  const [loading, setLoading] = useState(true)
  const [favorites, setFavorites] = useState<FavoriteRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadFavorites = async () => {
      const restaurantHeaders =
        venueRestaurantId && venueRestaurantId !== 'default'
          ? { 'x-ufo-restaurant': venueRestaurantId }
          : {}
      const doFetch = async () =>
        fetch('/api/favorites', {
          cache: 'no-store',
          credentials: 'include',
          headers: {
            'x-telegram-init-data': readTelegramInitData(),
            'x-telegram-start-param': readTelegramStartParam(),
            'x-telegram-user-id': readTelegramUserId(),
            ...restaurantHeaders,
          },
        })
      let res = await doFetch()
      if (res.status === 401) {
        await new Promise((r) => setTimeout(r, 450))
        res = await doFetch()
      }
      const data = await res.json().catch(() => null)
      if (cancelled) return
      if (!res.ok || !data?.ok || !Array.isArray(data.favorites)) {
        setError(data?.error || 'Не удалось загрузить избранное')
        return
      }
      setFavorites(data.favorites)
    }
    void loadFavorites()
      .catch(() => setError('Ошибка сети'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [venueRestaurantId])

  async function removeFavorite(dishId: string) {
    const previous = favorites
    setRemovingId(dishId)
    setFavorites((rows) => rows.filter((row) => row.dishId !== dishId))
    try {
      const restaurantHeaders =
        venueRestaurantId && venueRestaurantId !== 'default'
          ? { 'x-ufo-restaurant': venueRestaurantId }
          : {}
      const res = await fetch(`/api/favorites?dishId=${encodeURIComponent(dishId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'x-telegram-init-data': readTelegramInitData(),
          'x-telegram-start-param': readTelegramStartParam(),
          'x-telegram-user-id': readTelegramUserId(),
          ...restaurantHeaders,
        },
      })
      if (!res.ok) setFavorites(previous)
    } catch {
      setFavorites(previous)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <main className="ui-container ui-screen !pb-24">
      <PageHeader backHref="/profile" title="избранное" subtitle="любимые блюда и быстрый возврат в меню" />
      {loading ? (
        <div className="ui-surface p-4 text-[13px] text-[color:var(--muted)]">загрузка...</div>
      ) : error ? (
        <div className="ui-surface p-4 text-[13px] font-semibold text-red-500">{error}</div>
      ) : favorites.length === 0 ? (
        <div className="ui-surface p-5">
          <div className="text-[16px] font-extrabold text-[color:var(--text)]">Пока пусто</div>
          <p className="ui-muted mt-1 text-[13px]">Добавляйте блюда сердечком в меню, и они появятся здесь.</p>
          <Link
            href="/menu"
            prefetch={false}
            className="mt-4 flex h-11 items-center justify-center rounded-full bg-[color:var(--primary)] px-5 text-[14px] font-semibold text-white"
          >
            открыть меню
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((row) => {
            const dish = row.dish
            return (
              <div
                key={row.dishId}
                className="flex gap-3 rounded-[24px] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3 shadow-[var(--shadow-soft)]"
              >
                <Link href="/menu" prefetch={false} className="flex min-w-0 flex-1 gap-3 active:scale-[0.99]">
                  <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[20px] bg-[color:var(--surface)]">
                    {dish.image ? (
                      <OptimizedImage
                        src={dish.image}
                        alt=""
                        sizes={IMAGE_SIZES.favoriteThumb}
                        className="object-contain p-1"
                        quality={75}
                      />
                    ) : (
                      <span className="text-2xl">♥</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <div className="line-clamp-2 text-[15px] font-extrabold leading-tight text-[color:var(--text)]">{dish.name}</div>
                    <div className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
                      {dish.category?.name || (dish.isAvailable ? 'в меню' : 'на стопе')}
                    </div>
                    <div className="mt-2 text-[15px] font-extrabold tabular-nums text-[color:var(--text)]">{dish.price} ฿</div>
                  </div>
                </Link>
                <button
                  type="button"
                  disabled={removingId === row.dishId}
                  onClick={() => removeFavorite(row.dishId)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-black/38 transition active:scale-95 disabled:opacity-40"
                  aria-label="убрать из избранного"
                >
                  <IconTrash className="h-[18px] w-[18px]" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
