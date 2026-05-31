// Общие типы приложения

export type OrderStatus = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'

export type PaymentStatus =
  | 'PENDING'
  | 'AWAITING_RECEIPT'
  | 'UNDER_REVIEW'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'

export type SubscriptionPlan = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'DRAFT'

export interface User {
  id: string
  email: string
  name?: string
  phone?: string
  avatar?: string
  createdAt: Date
}

export type DishTag = 'new' | 'popular' | 'hit' | 'spicy' | 'vegetarian' | 'vegan' | 'healthy' | 'chef-choice'

export type DishModifier = {
  id: string
  name: string
  type: string
  priceAdjust: number
  order?: number
  /** Только для экранов подписки; в гостевом меню не используется. */
  subscriptionImageUrl?: string | null
}

export type DishOptionValue = {
  id: string
  name: string
  priceAdjust: number
  order?: number
  subscriptionImageUrl?: string | null
}

export type DishOptionGroup = {
  id: string
  name: string
  order?: number
  values: DishOptionValue[]
}

export interface Dish {
  id: string
  name: string
  description?: string
  /** Порция / вес на витрине, напр. «350 г». */
  weightLabel?: string | null
  price: number
  /** Себестоимость блюда для расчёта маржи. */
  costPrice?: number | null
  image?: string
  emoji?: string
  categoryId: string
  isAvailable: boolean
  calories?: number
  allergens?: string[]
  tags?: DishTag[]
  modifiers?: DishModifier[]
  optionGroups?: DishOptionGroup[]
  prepTimeMinutes?: number
  subscriptionEligible?: boolean
  maxOrderQuantity?: number
}

export interface Category {
  id: string
  name: string
  slug: string
  emoji?: string
  description?: string
  image?: string
}

export interface CartItem {
  id: string
  dishId: string
  quantity: number
  dish: Dish
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  totalAmount: number
  paymentStatus: PaymentStatus
  deliveryTime?: Date
  itemsCount?: number
  items: OrderItem[]
  address: Address
  createdAt: Date
}

export interface OrderItem {
  id: string
  dishId: string
  quantity: number
  price: number
  dish: Dish
}

export interface Address {
  id: string
  street: string
  city: string
  zipCode: string
  country: string
  isDefault: boolean
}

export interface Subscription {
  id: string
  userId: string
  name: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  price: number
  deliveryDays: number[]
  deliveryTime?: string
  startDate: Date
  endDate?: Date
  nextDelivery?: Date
  items: SubscriptionItem[]
}

export interface SubscriptionItem {
  id: string
  dishId: string
  quantity: number
  dayOfWeek?: number | null // 0=Вс..6=Сб. null = все дни
  dish: Dish
}

