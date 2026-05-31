import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem as BaseCartItem } from '@/types'
import { safePersistStorage } from '@/lib/safe-storage'

export type CartItemKind = 'dish' | 'store'

// dish-line (existing behavior)
export type StoredDishCartItem = Omit<BaseCartItem, 'dish'> & {
  kind?: 'dish'
  // shared CartItem requires `dish`, but the store must allow lightweight items (meta-only)
  dish?: BaseCartItem['dish']
  id: string
  dishId: string
  quantity: number
  modifierIds?: string[] // выбранные модификаторы или option value ids
  modifierLabels?: string[] // человекочитаемые подписи выбранных опций
  name?: string
  description?: string
  imageUrl?: string
  price?: number
}

// store-line (variant)
export type StoredStoreCartItem = {
  kind: 'store'
  id: string
  storeVariantId: string
  // compat: some existing UI assumes dish-like fields exist
  dishId?: string
  dish?: BaseCartItem['dish']
  productId?: string
  productName?: string
  name?: string
  variantName?: string
  quantity: number
  description?: string
  imageUrl?: string
  price?: number
  modifierIds?: string[]
  modifierLabels?: string[]
}

export type StoredCartItem = StoredDishCartItem | StoredStoreCartItem

export type DishMeta = Partial<StoredDishCartItem>
export type StoreVariantMeta = Partial<StoredStoreCartItem>

// loose input type for add-to-cart actions from UI components
export type AddToCartItem = {
  // dish flow
  dishId?: string
  modifierIds?: string[]
  modifierLabels?: string[]
  // store flow
  storeVariantId?: string
  productId?: string
  variantName?: string
  quantity?: number
  name?: string
  title?: string
  description?: string
  imageUrl?: string
  image?: string
  price?: number | string | null
  [key: string]: unknown
}

export interface CartStore {
  items: StoredCartItem[]
  restaurantId: string | null
  dishMetaById: Record<string, DishMeta>
  storeVariantMetaById: Record<string, StoreVariantMeta>
  upsertDishMeta: (dishId: string, meta: DishMeta) => void
  upsertStoreVariantMeta: (storeVariantId: string, meta: StoreVariantMeta) => void
  /** Всегда новый массив — не использовать как возвращаемое значение селектора `useCartStore(() => …)` (бесконечный ререндер). */
  getHydratedItems: () => StoredCartItem[]
  addItem: (item: AddToCartItem, restaurantId?: string) => void
  removeItem: (id: string, kind?: CartItemKind) => void
  updateQuantity: (id: string, quantity: number, kind?: CartItemKind) => void
  clearCart: () => void
  setRestaurantId: (id: string | null) => void
  syncWithVenue: (venueRestaurantId: string) => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,
      dishMetaById: {},
      storeVariantMetaById: {},
      upsertDishMeta: (dishId, meta) => {
        if (!dishId) return
        set((state) => ({
          dishMetaById: {
            ...state.dishMetaById,
            [dishId]: {
              ...(state.dishMetaById[dishId] ?? {}),
              ...meta,
              dishId,
            },
          },
        }))
      },
      upsertStoreVariantMeta: (storeVariantId, meta) => {
        if (!storeVariantId) return
        set((state) => ({
          storeVariantMetaById: {
            ...state.storeVariantMetaById,
            [storeVariantId]: {
              ...(state.storeVariantMetaById[storeVariantId] ?? {}),
              ...meta,
              kind: 'store',
              storeVariantId,
            },
          },
        }))
      },
      getHydratedItems: () => {
        const dishMeta = get().dishMetaById
        const storeMeta = get().storeVariantMetaById

        return get().items.map((item: any) => {
          const kind = (item?.kind ?? 'dish') as CartItemKind
          if (kind === 'store') {
            const storeVariantId = String(item?.storeVariantId ?? '')
            const m = storeVariantId ? (storeMeta[storeVariantId] ?? {}) : {}
            return {
              ...m,
              ...item,
              kind: 'store',
              id: String(item?.id ?? storeVariantId),
              storeVariantId,
              quantity: Number(item?.quantity ?? 0),
            } as StoredStoreCartItem
          }

          const dishId = String(item?.dishId ?? '')
          const m = dishId ? (dishMeta[dishId] ?? {}) : {}
          const modifierIds = Array.isArray(item?.modifierIds) ? item.modifierIds : []
          const modifierLabels = Array.isArray(item?.modifierLabels) ? item.modifierLabels : []
          return {
            ...m,
            ...item,
            kind: 'dish',
            id: String(item?.id ?? dishId),
            dishId,
            quantity: Number(item?.quantity ?? 0),
            modifierIds,
            modifierLabels,
          } as StoredDishCartItem
        })
      },
      addItem: (item, restaurantIdParam) => {
        const venueId = typeof restaurantIdParam === 'string' ? restaurantIdParam : null
        if (venueId) {
          const current = get().restaurantId
          const hasItems = get().items.length > 0
          if (hasItems && current !== null && current !== venueId) {
            set({ items: [], dishMetaById: {}, storeVariantMetaById: {}, restaurantId: venueId })
          } else if (!current || current !== venueId) {
            set({ restaurantId: venueId })
          }
        }

        const qtyToAdd = Number(item?.quantity ?? 1)
        const storeVariantId = typeof item?.storeVariantId === 'string' ? item.storeVariantId : ''
        const dishId = typeof item?.dishId === 'string' ? item.dishId : ''

        // store variant
        if (storeVariantId) {
          const modifierIds = Array.isArray((item as any)?.modifierIds) ? (item as any).modifierIds : []
          const modifierLabels = Array.isArray((item as any)?.modifierLabels) ? (item as any).modifierLabels : []
          const modifierKey = modifierIds.length ? '_' + [...modifierIds].sort().join(',') : ''
          const id = typeof (item as any)?.id === 'string' ? String((item as any).id) : String(storeVariantId) + modifierKey

          const candidateMeta: StoreVariantMeta = {
            kind: 'store',
            storeVariantId,
            ...(typeof item?.productId === 'string' ? { productId: item.productId } : {}),
            ...(typeof item?.name === 'string' ? { productName: item.name, name: item.name } : {}),
            ...(typeof item?.title === 'string' ? { productName: item.title, name: item.title } : {}),
            ...(typeof item?.variantName === 'string' ? { variantName: item.variantName } : {}),
            ...(typeof item?.description === 'string' ? { description: item.description } : {}),
            ...(item?.imageUrl ? { imageUrl: String(item.imageUrl) } : {}),
            ...(item?.image ? { imageUrl: String(item.image) } : {}),
            ...(item?.price != null ? { price: Number(item.price) } : {}),
            modifierIds,
            modifierLabels,
          }

          get().upsertStoreVariantMeta(storeVariantId, candidateMeta)

          const existingItem = get().items.find((i: any) => {
            if ((i?.kind ?? 'dish') !== 'store' || i?.storeVariantId !== storeVariantId) return false
            const a = Array.isArray(i?.modifierIds) ? [...i.modifierIds].sort().join(',') : ''
            const b = modifierIds.length ? [...modifierIds].sort().join(',') : ''
            return a === b
          })
          if (existingItem) {
            set((state) => ({
              items: state.items.map((i: any) => {
                if (!((i?.kind ?? 'dish') === 'store' && i?.storeVariantId === storeVariantId)) return i
                const a = Array.isArray(i?.modifierIds) ? [...i.modifierIds].sort().join(',') : ''
                const b = modifierIds.length ? [...modifierIds].sort().join(',') : ''
                if (a !== b) return i
                const nextQty = Number(i.quantity ?? 0) + qtyToAdd
                const merged: StoredStoreCartItem = {
                  ...(state.storeVariantMetaById[storeVariantId] ?? {}),
                  ...i,
                  ...(item as unknown as Partial<StoredStoreCartItem>),
                  kind: 'store',
                  id,
                  storeVariantId,
                  quantity: nextQty,
                  modifierIds,
                  modifierLabels,
                }
                return merged
              }),
            }))
          } else {
            set((state) => ({
              items: [
                ...state.items,
                {
                  ...(state.storeVariantMetaById[storeVariantId] ?? {}),
                  ...(item as unknown as Partial<StoredStoreCartItem>),
                  kind: 'store',
                  id,
                  storeVariantId,
                  quantity: qtyToAdd,
                  modifierIds,
                  modifierLabels,
                } as StoredStoreCartItem,
              ],
            }))
          }
          return
        }

        // dish (default)
        if (!dishId) return
        const modifierIds = Array.isArray((item as any)?.modifierIds) ? (item as any).modifierIds : []
        const modifierLabels = Array.isArray((item as any)?.modifierLabels) ? (item as any).modifierLabels : []
        const modifierKey = modifierIds.length ? '_' + [...modifierIds].sort().join(',') : ''
        const id = typeof (item as any)?.id === 'string' ? String((item as any).id) : String(dishId) + modifierKey

        const candidateMeta: DishMeta = {
          dishId,
          ...(typeof item?.name === 'string' ? { name: item.name } : {}),
          ...(typeof item?.title === 'string' ? { name: item.title } : {}),
          ...(typeof item?.description === 'string' ? { description: item.description } : {}),
          ...(item?.imageUrl ? { imageUrl: String(item.imageUrl) } : {}),
          ...(item?.image ? { imageUrl: String(item.image) } : {}),
          ...(item?.price != null ? { price: Number(item.price) } : {}),
        }

        get().upsertDishMeta(dishId, candidateMeta)

        const existingItem = get().items.find((i: any) => {
          if ((i?.kind ?? 'dish') !== 'dish' || i?.dishId !== dishId) return false
          const a = Array.isArray(i?.modifierIds) ? [...i.modifierIds].sort().join(',') : ''
          const b = modifierIds.length ? [...modifierIds].sort().join(',') : ''
          return a === b
        })
        if (existingItem) {
          set((state) => ({
            items: state.items.map((i: any) => {
              if (!((i?.kind ?? 'dish') === 'dish' && i?.dishId === dishId)) return i
              const a = Array.isArray(i?.modifierIds) ? [...i.modifierIds].sort().join(',') : ''
              const b = modifierIds.length ? [...modifierIds].sort().join(',') : ''
              if (a !== b) return i
              const nextQty = Number(i.quantity ?? 0) + qtyToAdd
              const merged: StoredDishCartItem = {
                ...(state.dishMetaById[dishId] ?? {}),
                ...i,
                ...(item as unknown as Partial<StoredDishCartItem>),
                kind: 'dish',
                id,
                dishId,
                quantity: nextQty,
                modifierIds,
                modifierLabels,
              }
              return merged
            }),
          }))
        } else {
          set((state) => ({
            items: [
              ...state.items,
              {
                ...(state.dishMetaById[dishId] ?? {}),
                ...(item as unknown as Partial<StoredDishCartItem>),
                kind: 'dish',
                id,
                dishId,
                quantity: qtyToAdd,
                modifierIds,
                modifierLabels,
              } as StoredDishCartItem,
            ],
          }))
        }
      },
      removeItem: (id, kind = 'dish') => {
        if (!id) return
        set((state) => ({
          items: state.items.filter((i: any) => {
            const k = (i?.kind ?? 'dish') as CartItemKind
            if (k !== kind) return true
            return k === 'store' ? i?.storeVariantId !== id : i?.id !== id
          }),
        }))
      },
      updateQuantity: (id, quantity, kind = 'dish') => {
        if (quantity <= 0) {
          get().removeItem(id, kind)
          return
        }
        set((state) => ({
          items: state.items.map((i: any) => {
            const k = (i?.kind ?? 'dish') as CartItemKind
            if (k !== kind) return i
            if (k === 'store') {
              return i?.storeVariantId === id ? { ...i, quantity, kind: 'store' } : i
            }
            return i?.id === id ? { ...i, quantity, kind: 'dish' } : i
          }),
        }))
      },
      clearCart: () => {
        set({ items: [] })
      },
      setRestaurantId: (id) => {
        set({ restaurantId: id })
      },
      syncWithVenue: (venueRestaurantId) => {
        const current = get().restaurantId
        const hasItems = get().items.length > 0
        if (hasItems && current !== null && current !== venueRestaurantId) {
          set({ items: [], dishMetaById: {}, storeVariantMetaById: {}, restaurantId: venueRestaurantId })
        } else {
          set({ restaurantId: venueRestaurantId })
        }
      },
      getTotal: () => {
        const safeNumber = (v: unknown): number => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : 0
        }

        const getUnitPrice = (item: StoredCartItem): number => {
          const anyItem = item as any
          const kind = (anyItem?.kind ?? 'dish') as CartItemKind

          if (kind === 'store') {
            const meta = get().storeVariantMetaById[String(anyItem?.storeVariantId ?? '')] as any
            return safeNumber(meta?.price ?? anyItem?.price)
          }

          const meta = get().dishMetaById[String(anyItem?.dishId ?? '')] as any

          // common shapes:
          // - { price }
          // - { dish: { price } }
          // - { item: { price } }
          // - { product: { price } }
          // - { variant: { price } }
          // - { menuItem: { price } }
          return safeNumber(
            meta?.price ??
              anyItem?.price ??
              anyItem?.dish?.price ??
              anyItem?.item?.price ??
              anyItem?.product?.price ??
              anyItem?.variant?.price ??
              anyItem?.menuItem?.price
          )
        }

        return get().items.reduce((total, item) => {
          const qty = safeNumber(item.quantity)
          return total + getUnitPrice(item) * qty
        }, 0)
      },
      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0)
      },
    }),
    {
      name: 'cart-storage',
      storage: safePersistStorage<
        Pick<CartStore, 'items' | 'restaurantId' | 'dishMetaById' | 'storeVariantMetaById'>
      >(),
      merge: (persistedState: any, currentState) => {
        try {
          const items = Array.isArray(persistedState?.items) ? persistedState.items : []
          const restaurantId =
            typeof persistedState?.restaurantId === 'string' ? persistedState.restaurantId : null
          const dishMetaById =
            persistedState?.dishMetaById && typeof persistedState.dishMetaById === 'object'
              ? persistedState.dishMetaById
              : {}
          const storeVariantMetaById =
            persistedState?.storeVariantMetaById && typeof persistedState.storeVariantMetaById === 'object'
              ? persistedState.storeVariantMetaById
              : {}

          const normalizedItems = items.map((it: any) => {
            if (!it || typeof it !== 'object') return it
            if (it.kind === 'store') return it
            if (typeof it.dishId === 'string' && it.dishId) return { ...it, kind: 'dish' }
            return it
          })

          return {
            ...currentState,
            items: normalizedItems,
            restaurantId,
            dishMetaById,
            storeVariantMetaById,
          }
        } catch {
          return currentState
        }
      },
    }
  )
)
