'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart-store'
import { useVenue } from '@/lib/venue-context'
import { InlineCounter } from '@/components/ui/InlineCounter'
import { cn } from '@/lib/utils'
import { IconHeart, IconChevronUp } from './icons'
import { IMAGE_SIZES, OptimizedImage } from '@/components/ui/OptimizedImage'
import { tagWithEmoji } from '@/lib/tag-labels'

export type ProductCardVariant = 'compact' | 'menu' | 'full'

export interface ProductCardProps {
  // Product data
  id: string
  name: string
  description?: string | null
  price: number
  image?: string | null
  isAvailable?: boolean
  /** Если false — нельзя добавить в корзину (витрина: стоп / нет цены / тег no-delivery и т.д.). */
  canAddToCart?: boolean
  /** Подпись вместо «в наличии», когда canAddToCart=false но isAvailable=true. */
  addBlockedReason?: string | null
  
  // Variant control
  variant?: ProductCardVariant
  
  // Additional info (for full variant)
  calories?: number | null
  allergens?: string[]
  tags?: string[]
  eta?: string // Restaurant: cooking time (e.g. "15–20 мин")
  /** Shop only: weight / volume / packaging (e.g. "500 г", "1 л"). Do not show eta in shop mode. */
  secondaryAttribute?: string | null
  
  /** Restaurant | shop: controls whether to show eta (restaurant) or secondaryAttribute (shop). */
  kind?: 'restaurant' | 'shop'
  
  // Cart integration
  cartQuantity?: number
  onAddToCart?: () => void
  onUpdateQuantity?: (qty: number) => void
  onRemoveFromCart?: () => void
  /** Called after item is added (e.g. when using internal add with modifiers) */
  onAdded?: () => void
  
  // Favorite
  isFavorite?: boolean
  onToggleFavorite?: () => void
  
  // Expandable
  expandable?: boolean
  defaultExpanded?: boolean
  
  // Category icon fallback
  categoryIcon?: string
  
  /** Visual: hit / priority (e.g. border or badge) */
  isHit?: boolean
  /** Visual: promo / special offer */
  isPromo?: boolean
  
  /** Dish modifiers (e.g. "без лука", "доп. соус") — show checkboxes and pass modifierIds to addItem */
  modifiers?: { id: string; name: string; type: string; priceAdjust: number }[]
  /** Max quantity per dish (anti-fraud). Default 10. */
  maxQuantity?: number
  /** Admin preview: no cart, optional edit click */
  previewMode?: boolean
  onEdit?: () => void
  /** Admin preview: tap media to upload/replace image */
  onImageClick?: () => void
  imageUploading?: boolean
  imageClickHint?: string
  /** Hide secondary line (в наличии / weight etc) — for admin preview */
  hideSecondaryLine?: boolean
  
  // Custom className
  className?: string
  
  // Click handler (for navigation)
  onClick?: () => void
}

// Default category icons
const defaultCategoryIcons: Record<string, string> = {
  '2': '🍔',
  '3': '🥗',
  '4': '🍟',
  '5': '🥘',
  '6': '🥤',
  popular: '🔥',
  burgers: '🍔',
  soups: '🍜',
  salads: '🥗',
  snacks: '🍟',
}

export function ProductCard({
  id,
  name,
  description,
  price,
  image,
  isAvailable = true,
  canAddToCart = true,
  addBlockedReason,
  variant = 'compact',
  calories,
  allergens,
  tags,
  eta,
  secondaryAttribute,
  kind = 'restaurant',
  cartQuantity = 0,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onAdded,
  isFavorite = false,
  onToggleFavorite,
  expandable = false,
  defaultExpanded = false,
  categoryIcon,
  isHit,
  isPromo,
  modifiers,
  maxQuantity = 10,
  previewMode = false,
  onEdit,
  onImageClick,
  imageUploading = false,
  imageClickHint = 'загрузить фото',
  hideSecondaryLine = false,
  className,
  onClick,
}: ProductCardProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const addItem = useCartStore((state) => state.addItem)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const items = useCartStore((state) => state.items)
  const { restaurantId } = useVenue()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // When dish id changes, reset modifier selection
  useEffect(() => {
    setSelectedModifierIds([])
    setSelectedOptionId(null)
  }, [id])

  const optionModifiers = (modifiers || []).filter((m) => String(m.type || '').toUpperCase() === 'OPTION')
  const extraModifiers = (modifiers || []).filter((m) => String(m.type || '').toUpperCase() !== 'OPTION')
  const hasModifiers = optionModifiers.length > 0 || extraModifiers.length > 0
  const cartItemId = useMemo(() => {
    if (!hasModifiers) return id
    const allSelected = [...selectedModifierIds, ...(selectedOptionId ? [selectedOptionId] : [])]
    const key = allSelected.length ? '_' + [...allSelected].sort().join(',') : ''
    return id + key
  }, [id, hasModifiers, selectedModifierIds, selectedOptionId])

  // Cart quantity: when modifiers exist, use line id (dishId_modKey); else match by dishId
  const qty = cartQuantity > 0 && !hasModifiers
    ? cartQuantity
    : (() => {
        const item = items.find((i: any) => {
          if ((i?.kind ?? 'dish') === 'store') return false
          const itemId = String(i?.id ?? '')
          return itemId === cartItemId
        })
        return item ? Number(item?.quantity ?? 0) : 0
      })()

  const handleAdd = () => {
    if (!canAddToCart) return
    if (hasModifiers) {
      const modifierIds = [...selectedModifierIds, ...(selectedOptionId ? [selectedOptionId] : [])]
      addItem(
        {
          dishId: id,
          modifierIds,
          name,
          description: description ?? undefined,
          price,
          quantity: 1,
          imageUrl: image ?? undefined,
        },
        restaurantId
      )
      onAdded?.()
    } else if (onAddToCart) {
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
    if (!canAddToCart) return
    const nextQty = Math.min(qty + 1, maxQuantity)
    if (nextQty <= qty) return
    if (onUpdateQuantity && !hasModifiers) {
      onUpdateQuantity(nextQty)
    } else {
      updateQuantity(cartItemId, nextQty, 'dish')
    }
  }

  const handleDecrement = () => {
    if (qty <= 1) {
      if (onRemoveFromCart && !hasModifiers) {
        onRemoveFromCart()
      } else {
        removeItem(cartItemId, 'dish')
      }
    } else {
      if (onUpdateQuantity && !hasModifiers) {
        onUpdateQuantity(qty - 1)
      } else {
        updateQuantity(cartItemId, qty - 1, 'dish')
      }
    }
  }

  const icon = categoryIcon || defaultCategoryIcons[id] || '🍛'
  const img = String(image || '').trim()
  const showFullDetails = variant === 'full'

  /** One secondary attribute: shop = weight/volume. Restaurant: availability only (no eta). */
  const secondaryLine =
    kind === 'shop'
      ? (secondaryAttribute ?? '—')
      : !isAvailable
        ? 'нет в наличии'
        : !canAddToCart && addBlockedReason
          ? addBlockedReason
          : 'в наличии'

  const menuDimmed = kind === 'restaurant' && !canAddToCart && qty === 0
  const cardContent = (
    <div
      className={cn(
        'overflow-hidden transition',
        variant === 'compact' ? 'w-[260px] shrink-0 p-3' : variant === 'menu' ? 'w-[300px] max-w-full shrink-0 p-3' : 'p-3',
        'border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]',
        onClick && !expandable && 'cursor-pointer active:scale-[0.99]',
        menuDimmed && 'opacity-[0.82]',
        className
      )}
      style={{ borderRadius: 'var(--radius-large)' }}
      onClick={onClick && !expandable ? onClick : undefined}
    >
      {/* Image/Media */}
        <div
        className={cn(
          'relative w-full overflow-hidden bg-[color:var(--surface)]',
          variant === 'compact' ? 'h-28' : variant === 'menu' ? 'h-40' : 'h-[160px]'
        )}
        style={{ borderRadius: 'var(--radius-medium)' }}
      >
        {img ? (
          <OptimizedImage
            src={img}
            alt={name}
            sizes={variant === 'compact' ? IMAGE_SIZES.productCardCompact : IMAGE_SIZES.productCard}
            className="object-cover"
            quality={78}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <div className={cn(
              'opacity-90',
              variant === 'compact' ? 'text-5xl' : variant === 'menu' ? 'text-5xl' : 'text-6xl'
            )}>
              {icon}
            </div>
          </div>
        )}

        {previewMode && onImageClick && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onImageClick()
            }}
            className="absolute inset-0 z-[2] cursor-pointer"
            aria-label={imageClickHint}
            title={imageClickHint}
          >
            <span className="absolute bottom-2 right-2 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--text)] shadow-sm">
              {imageUploading ? 'загрузка…' : imageClickHint}
            </span>
          </button>
        )}

        {/* Price badge - more prominent */}
        <div className={cn(
          'absolute inline-flex items-center rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-1.5 font-extrabold tabular-nums backdrop-blur',
          (variant === 'compact' || variant === 'menu')
            ? 'left-3 top-3 text-[12px] text-[color:var(--text)]'
            : 'right-2 top-2 text-[14px] text-[color:var(--text)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
        )}>
          {formatPrice(price)}
        </div>

        {/* Hit / promo badge (optional, app identity) */}
        {(isHit || isPromo) && (
          <div
            className="absolute left-3 bottom-2 rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2 py-1 text-[10px] font-semibold text-[color:var(--text)] backdrop-blur"
            style={{ borderRadius: 'var(--radius-pill)' }}
          >
            {isHit ? 'хит' : 'акция'}
          </div>
        )}

        {/* Favorite: one tap without expanding, app identity (graphite/muted) */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite()
            }}
            className={cn(
              'absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition',
              isFavorite
                ? 'bg-[color:var(--surface)] text-[color:var(--text)] border-[color:var(--stroke-strong)]'
                : 'bg-[color:var(--surface-strong)] text-[color:var(--muted)] border-[color:var(--stroke)]'
            )}
            style={{ borderRadius: 'var(--radius-pill)' }}
            aria-label={isFavorite ? 'удалить из избранного' : 'добавить в избранное'}
          >
            <IconHeart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
          </button>
        )}

        {/* In cart badge (only when mounted and in cart) */}
        {isMounted && qty > 0 && variant === 'full' && (
          <div className="absolute left-2 top-2 rounded-full bg-[color:var(--accent)] px-3 py-1 text-[12px] font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.14)]">
            в корзине · {qty}
          </div>
        )}

        {/* Tags: full = overlay, compact = same spot */}
        {tags && tags.length > 0 && (
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 2).map((tag) => (
              <div
                key={tag}
                className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text)]"
              >
                {tagWithEmoji(tag)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn((variant === 'compact' || variant === 'menu') ? 'mt-3' : 'px-1 pt-3')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={cn(
              'ui-body font-semibold',
              (variant === 'compact' || variant === 'menu') ? 'truncate' : 'line-clamp-2'
            )}>
              {name}
            </div>
            {!isExpanded && !hideSecondaryLine && (
              <div className="ui-muted mt-0.5 text-[12px] line-clamp-1">
                {secondaryLine}
              </div>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {expandable && isExpanded && (
          <div className="mt-3 space-y-3 border-t border-[color:var(--stroke)] pt-3">
            {description && (
              <div className="ui-body text-[14px] leading-relaxed">{description}</div>
            )}
            {optionModifiers.length > 0 && (
              <div className="space-y-2">
                <div className="ui-muted text-[11px] font-medium uppercase tracking-wide">Выберите вариант (необязательно)</div>
                <div className="flex flex-wrap gap-2">
                  {optionModifiers.map((mod) => {
                    const checked = selectedOptionId === mod.id
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => setSelectedOptionId((prev) => (prev === mod.id ? null : mod.id))}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition',
                          checked
                            ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
                            : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--text)]'
                        )}
                        style={{ borderRadius: 'var(--radius-pill)' }}
                      >
                        <span>{mod.name}</span>
                        {mod.priceAdjust > 0 && (
                          <span className="tabular-nums text-[11px] opacity-80">+{formatPrice(mod.priceAdjust)}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {extraModifiers.length > 0 && (
              <div className="space-y-2">
                <div className="ui-muted text-[11px] font-medium uppercase tracking-wide">Добавить или убрать</div>
                <div className="flex flex-wrap gap-2">
                  {extraModifiers.map((mod) => {
                    const checked = selectedModifierIds.includes(mod.id)
                    return (
                      <label
                        key={mod.id}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition',
                          checked
                            ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
                            : 'border-[color:var(--stroke)] bg-[color:var(--surface)] text-[color:var(--text)]'
                        )}
                        style={{ borderRadius: 'var(--radius-pill)' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedModifierIds((prev) =>
                              prev.includes(mod.id) ? prev.filter((x) => x !== mod.id) : [...prev, mod.id]
                            )
                          }}
                          className="sr-only"
                        />
                        <span>{mod.name}</span>
                        {mod.priceAdjust > 0 && (
                          <span className="tabular-nums text-[11px] opacity-80">+{formatPrice(mod.priceAdjust)}</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
            {(calories || (allergens && allergens.length > 0)) && (
              <div className="flex flex-wrap gap-2">
                {calories && (
                  <span className="chip text-[11px]">
                    🔥 {calories} ккал
                  </span>
                )}
                {allergens && allergens.length > 0 && (
                  <span className="chip text-[11px]">
                    ⚠️ {allergens.slice(0, 2).join(', ')}
                    {allergens.length > 2 ? '…' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Full variant: Calories & Allergens (only if not expandable) */}
        {showFullDetails && !expandable && (calories || (allergens && allergens.length > 0)) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {calories && (
              <span className="chip text-[11px]">
                🔥 {calories} ккал
              </span>
            )}
            {allergens && allergens.length > 0 && (
              <span className="chip text-[11px]">
                ⚠️ {allergens.slice(0, 2).join(', ')}
                {allergens.length > 2 ? '…' : ''}
              </span>
            )}
          </div>
        )}

        {/* Cart / Edit area */}
        <div
          className={cn(
            'flex min-h-[2.25rem] items-center justify-between gap-2',
            (variant === 'compact' || variant === 'menu') ? 'mt-2' : 'mt-3'
          )}
        >
          <div className="min-w-0">
            {previewMode ? (
              onEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit() }}
                  className="ui-muted text-[11px] font-medium transition active:opacity-70"
                >
                  редактировать
                </button>
              )
            ) : expandable && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsExpanded((v) => !v)
                }}
                className="ui-muted inline-flex h-8 items-center gap-0.5 text-[11px] font-medium transition active:opacity-70"
              >
                {isExpanded ? 'свернуть' : 'детали'}
                <IconChevronUp className={cn('h-3 w-3', isExpanded && 'rotate-180')} />
              </button>
            )}
          </div>
          {!previewMode && (
          <div className="shrink-0 [.ufo-counter__val]:text-[13px] [.ufo-counter__val]:font-medium [.ufo-counter__val]:text-[color:var(--text)]">
            {qty > 0 ? (
              <InlineCounter
                value={qty}
                onDec={handleDecrement}
                onInc={canAddToCart ? handleIncrement : () => {}}
                max={maxQuantity}
              />
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAdd()
                }}
                disabled={!isAvailable || !canAddToCart}
                className="btn btn-soft inline-flex h-8 min-w-[2.25rem] shrink-0 items-center justify-center rounded-full px-3 text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderRadius: 'var(--radius-pill)' }}
                aria-label="Добавить в корзину"
              >
                +
              </button>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )

  // Wrap in snap container for horizontal scrolling
  if (variant === 'compact' || variant === 'menu') {
    return <div className="snap-start">{cardContent}</div>
  }

  return cardContent
}
