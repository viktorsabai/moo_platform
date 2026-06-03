'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { cn, formatPrice } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import type { CatalogProduct } from './AdminSubscriptionDashboard'

type Props = {
  open: boolean
  dishes: CatalogProduct[]
  onClose: () => void
  onSaved: (dishId: string, costPrice: number | null) => void
}

export function AdminSubscriptionCostSheet({ open, dishes, onClose, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const next: Record<string, string> = {}
    for (const d of dishes) {
      next[d.id] = d.costPrice != null && d.costPrice > 0 ? String(d.costPrice) : ''
    }
    setDrafts(next)
  }, [open, dishes])

  const sorted = useMemo(
    () => [...dishes].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [dishes]
  )

  async function saveOne(dish: CatalogProduct) {
    const raw = (drafts[dish.id] ?? '').trim()
    const costPrice =
      raw === '' ? null : Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : null
    if (raw !== '' && costPrice == null) {
      toast.error('Введите себестоимость больше 0')
      return
    }
    setSavingId(dish.id)
    try {
      const res = await fetch('/api/admin/subscriptions/product-cost', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'dish', id: dish.id, costPrice }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error || 'Не сохранено')
        return
      }
      onSaved(dish.id, costPrice)
      toast.success(`${dish.name}: сохранено`)
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSavingId(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[125] flex flex-col justify-end bg-black/45" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0" aria-label="закрыть" onClick={onClose} />
      <div className="relative max-h-[88dvh] rounded-t-[var(--radius-large)] bg-[color:var(--surface-strong)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[color:var(--stroke)] px-4 py-3">
          <div>
            <p className="text-[15px] font-bold">себестоимость</p>
            <p className="text-[12px] text-[color:var(--muted)]">
              {sorted.length} блюд в каталоге подписки · только для подсказки маржи
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-soft h-9 rounded-full px-4 text-[13px] font-semibold">
            готово
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[color:var(--muted)]">
            Все блюда в слотах уже с себестоимостью
          </p>
        ) : (
          <ul className="max-h-[70dvh] space-y-2 overflow-y-auto px-3 py-3">
            {sorted.map((dish) => {
              const busy = savingId === dish.id
              return (
                <li
                  key={dish.id}
                  className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/[0.04]">
                      {dish.image ? (
                        <OptimizedImage src={dish.image} alt="" className="object-cover" sizes={IMAGE_SIZES.cartRow} />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[18px]">{dish.emoji || '🍽'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{dish.name}</p>
                      <p className="text-[11px] tabular-nums text-[color:var(--muted)]">меню {formatPrice(dish.price)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">себестоимость {dish.name}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="decimal"
                        placeholder="฿ себест."
                        value={drafts[dish.id] ?? ''}
                        onChange={(e) => setDrafts((s) => ({ ...s, [dish.id]: e.target.value }))}
                        className="w-full rounded-lg border border-[color:var(--stroke)] bg-transparent px-3 py-2 text-[14px] tabular-nums"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveOne(dish)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50',
                        'bg-[color:var(--primary)]'
                      )}
                    >
                      {busy ? '…' : 'ок'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
