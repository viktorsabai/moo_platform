'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { fmtThb } from '@/components/kit'

/** Одна полоска над нижней панелью: сколько в корзине и сколько это стоит. Тап — в оформление. */
export function StickyCartBar() {
  const pathname = usePathname() || ''
  const items = useCartStore((s) => s.items)
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
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[150] mx-auto w-full max-w-md px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--ufo-bottomnav-h, 72px) + 10px)' }}>
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
