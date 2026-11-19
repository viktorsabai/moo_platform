'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { fmtThb } from '@/components/kit'
import { useDeliveryHint } from '@/store/delivery-hint-store'

/**
 * Полоска над нижней панелью: сколько в корзине и сколько это стоит. Тап — в оформление.
 * Если известен порог бесплатной доставки — подсказывает, сколько осталось добрать.
 */
export function StickyCartBar() {
  const pathname = usePathname() || ''
  const items = useCartStore((s) => s.items)
  const freeFrom = useDeliveryHint((s) => s.freeFrom)
  const fee = useDeliveryHint((s) => s.fee)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { count, total } = useMemo(() => {
    let count = 0
    let total = 0
    for (const it of items) {
      const q = Number(it.quantity ?? 0)
      count += q
      total += q * Number(it.price ?? 0)
    }
    return { count, total }
  }, [items])

  const hide = pathname.startsWith('/checkout') || pathname.startsWith('/cart') || pathname.startsWith('/admin') || pathname.startsWith('/subscriptions/new') || pathname.startsWith('/requests')
  if (hide || !mounted || count === 0) return null

  const word = count === 1 ? 'позиция' : count < 5 ? 'позиции' : 'позиций'
  const showFree = Boolean(freeFrom && fee && fee > 0)
  const left = showFree ? Math.max(0, (freeFrom as number) - total) : 0
  const progress = showFree ? Math.min(1, total / (freeFrom as number)) : 0
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[150] mx-auto w-full max-w-md px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--ufo-bottomnav-h, 72px) + 10px)' }}>
      {showFree ? (
        <div className="pointer-events-auto mb-1.5 overflow-hidden rounded-[14px] bg-[color:var(--surface-strong)] px-3.5 backdrop-blur-md py-2 shadow-[var(--shadow-card)]">
          <div className="text-[12.5px] font-semibold text-[color:var(--text)]">
            {left > 0 ? <>ещё {fmtThb(left)} до бесплатной доставки</> : <span className="text-[color:var(--ok)]">доставка будет бесплатной</span>}
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[color:var(--surface)]">
            <div className="h-full rounded-full bg-[color:var(--ok)] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      ) : null}
      <Link
        href="/checkout"
        prefetch={false}
        className="pointer-events-auto flex h-[52px] items-center justify-between rounded-[18px] bg-[color:var(--primary)] px-[18px] text-[15px] font-semibold text-[color:var(--on-primary)] shadow-[var(--shadow-card)] transition active:scale-[0.99]"
      >
        <span>корзина · {count} {word}</span>
        <span>{fmtThb(total)}</span>
      </Link>
    </div>
  )
}
