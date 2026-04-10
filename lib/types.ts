export type Profile = {
  id: string
  full_name: string
  phone: string | null
  default_location_id: string | null
  is_admin: boolean
  created_at: string
}

export type LocationAxis = {
  id: string
  name: string
  delivery_fee: number
  is_active: boolean
}

export type Product = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  category: 'cuts' | 'special parts'
  is_available: boolean
  sort_order: number
}

export type ProductVariant = {
  id: string
  product_id: string
  name: string
  price: number
  is_available: boolean
}

export type CycleStock = {
  id: string
  cycle_id: string
  variant_id: string
  stock_slots: number
  sold_slots: number
  remaining_slots: number
  product_name: string
  variant_name: string
  price: number
}

export type BookingCycle = {
  id: string
  title: string
  status: 'open' | 'closed'
  slaughter_date: string
  order_limit: number
  current_orders: number
  notes: string | null
  created_at: string
}

export type Order = {
  id: string
  user_id: string
  cycle_id: string
  recipient_name: string
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled'
  payment_method: 'pay_now' | 'bank_transfer' | 'pay_on_delivery'
  payment_status: 'paid' | 'pod_pending' | 'pod_settled' | 'waived'
  delivery_type: 'delivery' | 'pickup'
  location_id: string | null
  delivery_fee: number
  total_amount: number
  paystack_ref: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export type OrderItem = {
  id: string
  order_id: string
  variant_id: string
  quantity: number
  unit_price: number
  subtotal: number
  with_inu_eran: boolean
}

export type CartItem = {
  variant_id: string
  product_name: string
  variant_name: string
  price: number
  quantity: number
  with_inu_eran: boolean
}