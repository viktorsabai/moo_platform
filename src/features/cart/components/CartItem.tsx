'use client'

import { useCartStore } from '@/store/cart-store'
import { formatPrice } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'

type CartItemModel = {
  id?: string
  dishId: string
  name?: string | null
  price?: number | null
  quantity: number
  imageUrl?: string | null
}

type Props = { item: CartItemModel }

export function CartItem({ item }: Props) {
  const { updateQuantity, removeItem } = useCartStore()

  const qty = item.quantity ?? 0

  const itemId = item.id ?? item.dishId
  const onMinus = () => {
    const nextQty = qty - 1
    if (nextQty <= 0) {
      removeItem(itemId, 'dish')
      return
    }
    updateQuantity(itemId, nextQty, 'dish')
  }

  const onPlus = () => {
    updateQuantity(itemId, qty + 1, 'dish')
  }

  const onRemove = () => removeItem(itemId, 'dish')

  const title = item.name ?? 'товар'
  const unitPrice = item.price == null ? null : item.price
  const priceLabel = unitPrice == null ? null : formatPrice(unitPrice)
  const totalLabel = unitPrice == null ? null : formatPrice(unitPrice * qty)

  return (
    <div className="ui-surface-strong p-4">
      <div className="flex gap-3">
        {/* thumbnail */}
        <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-2xl bg-[color:var(--surface-strong)]">
          {item.imageUrl ? (
            <OptimizedImage
              src={item.imageUrl}
              alt={title}
              sizes={IMAGE_SIZES.cartRow}
              className="object-cover"
              quality={72}
            />
          ) : (
            <div className="grid h-full w-full place-items-center">
              <div className="h-9 w-9 rounded-2xl bg-black/[0.04]" />
            </div>
          )}
        </div>

        {/* content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-black/90">
                {title}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-black/40">
                {priceLabel ? <span className="tabular-nums">{priceLabel} / шт</span> : <span>—</span>}
                {qty > 1 ? <span className="tabular-nums">× {qty}</span> : null}
              </div>
            </div>

            <div className="shrink-0 text-right">
              {totalLabel ? (
                <div className="text-[16px] font-extrabold tabular-nums text-[color:var(--accent)]">
                  {totalLabel}
                </div>
              ) : (
                <div className="text-[16px] font-extrabold text-black/35">—</div>
              )}

              <button
                type="button"
                aria-label="удалить"
                onClick={onRemove}
                className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-[16px] font-semibold leading-none text-black/45 shadow-[0_6px_14px_rgba(0,0,0,0.04)] transition hover:text-black/65 active:scale-[0.98]"
              >
                ×
              </button>
            </div>
          </div>

          {/* controls */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.02] p-1">
              <button
                type="button"
                aria-label="уменьшить"
                onClick={onMinus}
                className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-semibold text-black/60 transition hover:bg-black/[0.03] active:scale-[0.98]"
              >
                −
              </button>

              <div className="min-w-[30px] px-2 text-center text-[13px] font-semibold tabular-nums text-black/70">
                {qty}
              </div>

              <button
                type="button"
                aria-label="увеличить"
                onClick={onPlus}
                className="btn btn-primary grid h-8 w-8 place-items-center rounded-full text-[16px] font-semibold transition active:scale-[0.98]"
              >
                +
              </button>
            </div>

            <div className="text-[12px] font-semibold text-black/35">
              {priceLabel ? <span className="tabular-nums">{priceLabel} / шт</span> : <span>—</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CartItem
