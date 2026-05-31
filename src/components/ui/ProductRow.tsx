'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { ListRow } from '@/components/ui/ListRow'
import { cn } from '@/lib/utils'
import { IconHeart } from './icons'

export interface ProductRowProps {
  // Product data
  id: string
  name: string
  description?: string | null
  price: number
  image?: string | null
  isAvailable?: boolean
  
  // Additional info
  eta?: string
  calories?: number | null
  allergens?: string[]
  tags?: string[]
  
  // Cart integration
  cartQuantity?: number
  onAddToCart?: () => void
  onUpdateQuantity?: (qty: number) => void
  onRemoveFromCart?: () => void
  
  // Favorite
  isFavorite?: boolean
  onToggleFavorite?: () => void
  
  // Custom className
  className?: string
}

export function ProductRow({
  id,
  name,
  description,
  price,
  image,
  isAvailable = true,
  eta,
  calories,
  allergens,
  tags,
  cartQuantity = 0,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  isFavorite = false,
  onToggleFavorite,
  className,
}: ProductRowProps) {
  const addItem = useCartStore((state) => state.addItem)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const items = useCartStore((state) => state.items)
  const { restaurantId } = useVenue()

  // Auto-detect cart quantity if not provided
  const qty = cartQuantity > 0 
    ? cartQuantity 
    : (() => {
        const item = items.find((i: any) => {
          const itemId = String(i?.dishId ?? i?.id ?? '')
          return itemId === id
        })
        return item ? Number(item?.quantity ?? 0) : 0
      })()

  const handleAdd = () => {
    if (onAddToCart) {
      onAddToCart()
    } else {
      addItem(
        {
          dishId: id,
          name,
          description: description ?? undefined,
          price,
          quantity: 1,
          imageUrl: image ?? undefined,
        },
        restaurantId
      )
    }
  }

  const handleIncrement = () => {
    if (onUpdateQuantity) {
      onUpdateQuantity(qty + 1)
    } else {
      updateQuantity(id, qty + 1, 'dish')
    }
  }

  const handleDecrement = () => {
    if (qty <= 1) {
      if (onRemoveFromCart) {
        onRemoveFromCart()
      } else {
        removeItem(id, 'dish')
      }
    } else {
      if (onUpdateQuantity) {
        onUpdateQuantity(qty - 1)
      } else {
        updateQuantity(id, qty - 1, 'dish')
      }
    }
  }

  const img = String(image || '').trim()
  const metaParts = [
    formatPrice(price),
    eta,
  ].filter(Boolean)

  return (
    <ListRow
      left={
        <div className="relative h-11 w-11 overflow-hidden rounded-2xl bg-[color:var(--surface-strong)] shrink-0">
          {img ? (
            <OptimizedImage src={img} alt="" sizes={IMAGE_SIZES.productRow} className="object-cover" quality={72} />
          ) : (
            <div
              aria-hidden
              className="h-full w-full"
              style={{
                background:
                  'radial-gradient(80px 60px at 20% 0%, rgba(0,0,0,.10), transparent 62%), radial-gradient(80px 60px at 100% 70%, rgba(0,0,0,.06), transparent 62%), rgba(0,0,0,.02)',
              }}
            />
          )}
        </div>
      }
      title={name}
      subtitle={description ?? undefined}
      meta={metaParts.length ? metaParts.join(' • ') : undefined}
      right={
        <div className="flex items-center gap-2">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleFavorite()
              }}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full transition',
                isFavorite
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-white/60 text-black/40 border border-black/10'
              )}
              aria-label={isFavorite ? 'удалить из избранного' : 'добавить в избранное'}
            >
              <IconHeart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </button>
          )}
          {qty > 0 ? (
            <InlineCounter
              value={qty}
              onDec={handleDecrement}
              onInc={handleIncrement}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAdd()
              }}
              disabled={!isAvailable}
              className="btn btn-soft inline-flex h-8 items-center justify-center rounded-full px-3 text-[13px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Добавить в корзину"
            >
              +
            </button>
          )}
        </div>
      }
      className={cn('px-4 py-3', className)}
    />
  )
}
