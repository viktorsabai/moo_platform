import { create } from 'zustand'

/**
 * Пороги доставки заведения по умолчанию (AppSettings), чтобы панель корзины
 * могла подсказать «ещё N ฿ до бесплатной доставки». Точная сумма по зоне
 * считается в чекауте — здесь только ориентир. Заполняет главная (GuestMenu).
 */
type DeliveryHint = {
  fee: number | null
  freeFrom: number | null
  set: (fee: number | null, freeFrom: number | null) => void
}

export const useDeliveryHint = create<DeliveryHint>((set) => ({
  fee: null,
  freeFrom: null,
  set: (fee, freeFrom) => set({ fee, freeFrom }),
}))
