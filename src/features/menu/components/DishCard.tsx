'use client'

import type { Dish } from '@/types'
import { useCartStore } from '@/store/cart-store'
import { ProductCard } from '@/components/ui/ProductCard'
import toast from 'react-hot-toast'
import { dishMenuOrderHint, isDishOrderableForCart } from '@/lib/consumer-menu-orderable'

interface DishCardProps {
  dish: Dish
}

// Иконки для категорий
const categoryIcons: Record<string, string> = {
  '2': '🍔',
  '3': '🥗',
  '4': '🍟',
  '5': '🥘',
  '6': '🥤',
}

export function DishCard({ dish }: DishCardProps) {
  const orderable = isDishOrderableForCart(dish)
  const addBlockedReason = orderable ? null : dishMenuOrderHint(dish)
  const items = useCartStore((state) => state.items).filter((i: any) => (i?.kind ?? 'dish') !== 'store')
  const hasModifiers = Boolean(dish.modifiers?.length)
  const cartItem = items.find((item: any) => item.dishId === dish.id && !hasModifiers)
  const quantityInCart = (cartItem as any)?.quantity || 0

  const icon = categoryIcons[dish.categoryId] || '🍛'

  const photoSrc =
    (dish as any).imageUrl ||
    (dish as any).image ||
    (dish as any).photoUrl ||
    (dish as any).photo ||
    ''

  return (
    <ProductCard
      id={dish.id}
      name={dish.name}
      description={dish.description}
      price={dish.price}
      image={photoSrc}
      isAvailable={dish.isAvailable}
      canAddToCart={orderable}
      addBlockedReason={addBlockedReason}
      variant="full"
      calories={dish.calories}
      allergens={dish.allergens}
      tags={dish.tags}
      cartQuantity={hasModifiers ? undefined : quantityInCart}
      categoryIcon={icon}
      modifiers={dish.modifiers}
      maxQuantity={dish.maxOrderQuantity ?? 10}
      onAdded={() =>
        toast.success(`${dish.name} добавлено в корзину!`, { icon: '✅' })
      }
    />
  )
}
