'use client'

import { formatPrice } from '@/lib/utils'
import Link from 'next/link'

export type CartSummaryItem = {
  id: string
  name: string
  price: number
  quantity: number
}

export type CartSummaryProps = {
  items: CartSummaryItem[]
  subtotal: number
  deliveryFee: number
}

export function CartSummary({ items, subtotal, deliveryFee }: CartSummaryProps) {
  const total = Math.max(0, (subtotal || 0) + (deliveryFee || 0))
  const canCheckout = items.length > 0

  return (
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(420px,92%)] -translate-x-1/2 transition-all duration-300" data-scroll-hide>
      <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.06] shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[color:var(--accent)] opacity-[0.10]" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-white opacity-[0.04]" />
        </div>

        <div className="relative p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-extrabold tracking-tight text-white/85">к оплате</div>
              <div className="mt-0.5 text-[12px] font-semibold text-white/55">{items.length} поз.</div>
            </div>

            <div className="text-right">
              <div className="text-[20px] font-extrabold tabular-nums text-white/92">{formatPrice(total)}</div>
              <div className="mt-0.5 text-[12px] font-semibold text-white/55">
                доставка {deliveryFee === 0 ? 'бесплатно' : formatPrice(deliveryFee)}
              </div>
            </div>
          </div>

          {canCheckout ? (
            <Link
              href="/checkout"
              prefetch={false}
              scroll={false}
              className="block w-full rounded-[20px] bg-[color:var(--accent)] py-3 text-center text-[14px] font-semibold text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition active:scale-[0.98]"
            >
              оформить заказ
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="w-full rounded-[20px] bg-[color:var(--accent)] py-3 text-center text-[14px] font-semibold text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] opacity-40"
            >
              оформить заказ
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
