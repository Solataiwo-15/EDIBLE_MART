
export async function sendBookingOpenBlast(
  cycleTitle: string,
  slaughterDate: string,
) {
  const res = await fetch('/api/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'booking_open_blast',
      cycleTitle,
      slaughterDate,
    }),
  })

  const result = await res.json()

  if (!res.ok) {
    throw new Error(result.error || 'Email blast failed')
  }

  return result
}

export async function sendOrderConfirmation(params: { orderId: string }) {
  const res = await fetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'order_confirmation', orderId: params.orderId }),
  })

  const result = await res.json()

  if (!res.ok) {
    throw new Error(result.error || 'Order confirmation email failed')
  }

  return result
}