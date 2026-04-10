// lib/email.ts
// Call these functions from client components to send emails via the API route

export async function sendBookingOpenBlast(cycleTitle: string, slaughterDate: string) {
  const res = await fetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'booking_open_blast',
      cycleTitle,
      slaughterDate,
    }),
  })
  return res.json()
}

export async function sendOrderConfirmation(params: {
  customerEmail: string
  customerName: string
  recipientName: string
  orderNumber: string
  cycleTitle: string
  slaughterDate: string
  items: { name: string; variant: string; quantity: number; subtotal: number }[]
  deliveryType: string
  deliveryLocation: string | null
  paymentMethod: string
  totalAmount: number
  deliveryFee: number
}) {
  const res = await fetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'order_confirmation', ...params }),
  })
  return res.json()
}