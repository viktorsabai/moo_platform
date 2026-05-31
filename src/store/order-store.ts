import { create } from 'zustand'
import { persist, type StateStorage } from 'zustand/middleware'
import type { Order, OrderStatus } from '@/types'
import { safePersistStorage } from '@/lib/safe-storage'

interface OrderStore {
  orders: Order[]
  setOrders: (orders: Order[]) => void
  addOrder: (order: Omit<Order, 'userId' | 'id'> & { id?: string; userId?: string }) => Order
  updateOrderStatus: (id: string, status: OrderStatus) => void
  getOrder: (id: string) => Order | undefined
}

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis?.localStorage?.getItem(name) ?? null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      globalThis?.localStorage?.setItem(name, value)
    } catch {
      // ignore (quota / denied in some webviews)
    }
  },
  removeItem: (name) => {
    try {
      globalThis?.localStorage?.removeItem(name)
    } catch {
      // ignore
    }
  },
}

export const useOrderStore = create<OrderStore>()(
  persist<OrderStore, [], [], { orders: Order[] }>(
    (set, get) => ({
      orders: [],
      setOrders: (orders) => set({ orders }),
      addOrder: (orderData) => {
        const id = (orderData as any)?.id ? String((orderData as any).id) : `order_${Date.now()}`
        const userId = (orderData as any)?.userId ? String((orderData as any).userId) : 'current_user'

        const newOrder: Order = {
          ...(orderData as any),
          id,
          userId,
          createdAt: (orderData as any)?.createdAt ? new Date((orderData as any).createdAt) : new Date(),
        }

        set((state) => {
          const existingIdx = state.orders.findIndex((o) => o.id === newOrder.id)
          if (existingIdx >= 0) {
            const next = state.orders.slice()
            next[existingIdx] = { ...next[existingIdx], ...newOrder }
            return { orders: next }
          }
          return { orders: [newOrder, ...state.orders] } // Новые сверху
        })

        return newOrder
      },
      updateOrderStatus: (id, status) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id ? { ...order, status } : order
          ),
        }))
      },
      getOrder: (id) => {
        return get().orders.find((order) => order.id === id)
      },
    }),
    {
      name: 'orders-storage',
      storage: safePersistStorage<{ orders: Order[] }>(),
      partialize: (state) => ({
        orders: (state.orders ?? []).slice(0, 50).map((o: any) => ({
          id: String(o?.id ?? ''),
          userId: String(o?.userId ?? 'current_user'),
          status: o?.status ?? 'PENDING',
          totalAmount: Number(o?.totalAmount ?? 0),
          paymentStatus: o?.paymentStatus ?? 'PENDING',
          deliveryTime: o?.deliveryTime ?? null,
          createdAt: o?.createdAt ?? null,
          itemsCount: Number(o?.itemsCount ?? o?.items?.length ?? 0),
          items: [],
          address: {
            id: String(o?.address?.id ?? ''),
            street: String(o?.address?.street ?? ''),
            city: String(o?.address?.city ?? ''),
            zipCode: String(o?.address?.zipCode ?? ''),
            country: String(o?.address?.country ?? 'Thailand'),
            isDefault: Boolean(o?.address?.isDefault ?? true),
          },
        })),
      }),
      merge: (persistedState: any, currentState) => {
        try {
          const pOrders = Array.isArray(persistedState?.orders) ? persistedState.orders : []
          return {
            ...currentState,
            orders: pOrders,
          }
        } catch {
          return currentState
        }
      },
    }
  )
)




