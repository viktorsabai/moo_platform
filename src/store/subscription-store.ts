import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Subscription } from '@/types'

interface SubscriptionStore {
  subscriptions: Subscription[]
  setSubscriptions: (subscriptions: Subscription[]) => void
  addSubscription: (subscription: Omit<Subscription, 'userId' | 'id'> & { id?: string; userId?: string }) => Subscription
  updateSubscription: (id: string, updates: Partial<Subscription>) => void
  deleteSubscription: (id: string) => void
  getSubscription: (id: string) => Subscription | undefined
}

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      setSubscriptions: (subscriptions) => set({ subscriptions }),
      addSubscription: (subscriptionData) => {
        const id = (subscriptionData as any)?.id ? String((subscriptionData as any).id) : `sub_${Date.now()}`
        const userId = (subscriptionData as any)?.userId ? String((subscriptionData as any).userId) : 'current_user'
        const newSubscription: Subscription = {
          ...(subscriptionData as any),
          id,
          userId,
          startDate: (subscriptionData as any)?.startDate ? new Date((subscriptionData as any).startDate) : new Date(),
          nextDelivery: (subscriptionData as any)?.nextDelivery ? new Date((subscriptionData as any).nextDelivery) : undefined,
        }

        set((state) => {
          const existingIdx = state.subscriptions.findIndex((s) => s.id === newSubscription.id)
          if (existingIdx >= 0) {
            const next = state.subscriptions.slice()
            next[existingIdx] = { ...next[existingIdx], ...newSubscription }
            return { subscriptions: next }
          }
          return { subscriptions: [newSubscription, ...state.subscriptions] }
        })

        return newSubscription
      },
      updateSubscription: (id, updates) => {
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) =>
            sub.id === id ? { ...sub, ...updates } : sub
          ),
        }))
      },
      deleteSubscription: (id) => {
        set((state) => ({
          subscriptions: state.subscriptions.filter((sub) => sub.id !== id),
        }))
      },
      getSubscription: (id) => {
        return get().subscriptions.find((sub) => sub.id === id)
      },
    }),
    {
      name: 'subscriptions-storage',
    }
  )
)
