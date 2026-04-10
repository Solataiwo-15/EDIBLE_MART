import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CartItem } from '@/lib/types'

type CartStore = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (variant_id: string, with_inu_eran: boolean) => void
  updateQuantity: (variant_id: string, with_inu_eran: boolean, quantity: number) => void
  clearCart: () => void
  total: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        const existing = get().items.find(
          i => i.variant_id === newItem.variant_id && i.with_inu_eran === newItem.with_inu_eran
        )
        if (existing) {
          set(s => ({
            items: s.items.map(i =>
              i.variant_id === newItem.variant_id && i.with_inu_eran === newItem.with_inu_eran
                ? { ...i, quantity: i.quantity + newItem.quantity }
                : i
            ),
          }))
        } else {
          set(s => ({ items: [...s.items, newItem] }))
        }
      },

      removeItem: (variant_id, with_inu_eran) => {
        set(s => ({
          items: s.items.filter(
            i => !(i.variant_id === variant_id && i.with_inu_eran === with_inu_eran)
          ),
        }))
      },

      updateQuantity: (variant_id, with_inu_eran, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variant_id, with_inu_eran)
          return
        }
        set(s => ({
          items: s.items.map(i =>
            i.variant_id === variant_id && i.with_inu_eran === with_inu_eran
              ? { ...i, quantity }
              : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      total: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: 'edible-mart-cart', // persists cart in localStorage
    }
  )
)