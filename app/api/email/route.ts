import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = process.env.FROM_EMAIL ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const BANK_ACCOUNT = '0043750696'
const BANK_NAME = 'Access Bank'
const ACCOUNT_NAME = 'TMC'

// Escape dynamic text before inserting into email HTML
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Email templates ──────────────────────────────────────────

function bookingOpenEmail(customerName: string, cycleTitle: string, slaughterDate: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;">

      <tr><td style="background:#1C0A06;padding:28px 32px;">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">EDIBLE MART</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Fresh beef, every Saturday</p>
      </td></tr>

      <tr><td style="padding:32px;">
        <p style="margin:0 0 8px;color:#1C0A06;font-size:24px;font-weight:bold;">Bookings are open! 🥩</p>
        <p style="margin:0 0 24px;color:#666;font-size:15px;line-height:1.6;">
          Hi ${customerName}, a new booking cycle is now open. Secure your slot before we sell out!
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin-bottom:24px;">
          <tr><td style="padding:20px;">
            <p style="margin:0 0 4px;color:#999;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">This week</p>
            <p style="margin:0 0 10px;color:#1C0A06;font-size:18px;font-weight:bold;">${cycleTitle}</p>
            <p style="margin:0;color:#666;font-size:14px;">📅 Slaughter day: <strong>${slaughterDate}</strong></p>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${APP_URL}/products"
               style="display:inline-block;background:#E8231A;color:#fff;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 40px;border-radius:12px;">
              Browse &amp; Book Now →
            </a>
          </td></tr>
        </table>
        <p style="margin:24px 0 0;color:#999;font-size:13px;text-align:center;">
          Slots are limited — book early to avoid missing out.
        </p>
      </td></tr>

      <tr><td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
        <p style="margin:0;color:#bbb;font-size:12px;text-align:center;">
          Edible Mart · You're receiving this because you have an account with us.<br/>
          Questions? Reach us on WhatsApp.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim()
}

function orderConfirmationEmail(params: {
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
  const {
    customerName, recipientName, orderNumber, cycleTitle, slaughterDate,
    items, deliveryType, deliveryLocation, paymentMethod, totalAmount, deliveryFee,
  } = params

  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;">
        ${esc(i.name)} (${esc(i.variant)}) × ${i.quantity}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:bold;font-size:14px;white-space:nowrap;">
        &#8358;${i.subtotal.toLocaleString()}
      </td>
    </tr>`).join('')

  const paymentLabel =
    paymentMethod === 'bank_transfer' ? 'Bank transfer' :
    paymentMethod === 'pay_on_delivery' ? 'Pay on delivery / pickup' : 'Paid online'

  const bankTransferNote = paymentMethod === 'bank_transfer' ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#FFF8E1;border:1px solid #FFE082;border-radius:12px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;color:#F57F17;font-size:13px;font-weight:bold;">⚠️ Payment required</p>
        <p style="margin:0;color:#795548;font-size:13px;line-height:1.6;">
          Please transfer <strong>&#8358;${totalAmount.toLocaleString()}</strong> to:<br/>
          <strong>Account:</strong> ${BANK_ACCOUNT}<br/>
          <strong>Bank:</strong> ${BANK_NAME} — ${ACCOUNT_NAME}<br/>
          Then send your payment screenshot on WhatsApp.
        </p>
      </td></tr>
    </table>` : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;">

      <tr><td style="background:#1C0A06;padding:28px 32px;">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">EDIBLE MART</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Order Confirmation</p>
      </td></tr>

      <tr><td style="padding:32px;">
        <p style="margin:0 0 4px;color:#1C0A06;font-size:22px;font-weight:bold;">Order confirmed ✅</p>
        <p style="margin:0 0 24px;color:#666;font-size:15px;">Hi ${esc(customerName)}, your order has been placed.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin-bottom:24px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 2px;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Order ref</p>
              <p style="margin:0;color:#1C0A06;font-size:20px;font-weight:bold;">${orderNumber}</p>
            </td>
            <td style="padding:16px 20px;text-align:right;">
              <p style="margin:0 0 2px;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Cycle</p>
              <p style="margin:0;color:#333;font-size:14px;font-weight:bold;">${esc(cycleTitle)}</p>
              <p style="margin:2px 0 0;color:#666;font-size:12px;">📅 ${slaughterDate}</p>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 12px;color:#1C0A06;font-size:15px;font-weight:bold;">Items ordered</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemsHtml}
          ${deliveryFee > 0 ? `
          <tr>
            <td style="padding:8px 0;color:#666;font-size:14px;">Delivery fee</td>
            <td style="padding:8px 0;text-align:right;font-size:14px;">&#8358;${deliveryFee.toLocaleString()}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:12px 0 0;color:#1C0A06;font-size:16px;font-weight:bold;">Total</td>
            <td style="padding:12px 0 0;text-align:right;color:#E8231A;font-size:16px;font-weight:bold;">&#8358;${totalAmount.toLocaleString()}</td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f9f9f9;border-radius:12px;">
          <tr><td style="padding:20px;">
            <p style="margin:0 0 8px;color:#333;font-size:14px;"><strong>Recipient:</strong> ${esc(recipientName)}</p>
            <p style="margin:0 0 8px;color:#333;font-size:14px;"><strong>Collection:</strong> ${deliveryType === 'delivery' ? (deliveryLocation ? `Delivery — ${esc(deliveryLocation)}` : 'Delivery') : 'Pickup'}</p>
            <p style="margin:0;color:#333;font-size:14px;"><strong>Payment:</strong> ${paymentLabel}</p>
          </td></tr>
        </table>

        ${bankTransferNote}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr><td align="center">
            <a href="${APP_URL}/orders"
               style="display:inline-block;background:#E8231A;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 32px;border-radius:10px;">
              View My Orders →
            </a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
        <p style="margin:0;color:#bbb;font-size:12px;text-align:center;">
          Edible Mart · Questions? Reach us on WhatsApp.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.trim()
}

// ── Route handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body

    const supabase = await createClient()

    // ── Booking open blast ──
    if (type === 'booking_open_blast') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const { cycleTitle, slaughterDate } = body

      // Get all profiles with stored emails, including admin
      const { data: customers, error: customersError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .not('email', 'is', null)

      if (customersError) {
        return NextResponse.json(
          { error: 'Could not fetch customer emails' },
          { status: 500 },
        )
      }

      if (!customers || customers.length === 0) {
        return NextResponse.json({
          sent: 0,
          message: 'No customers with emails found',
        })
      }

      // Remove empty and duplicate email addresses
      const recipients = Array.from(
        new Map(
          customers
            .filter(customer => customer.email?.trim())
            .map(customer => [
              customer.email!.trim().toLowerCase(),
              {
                full_name: customer.full_name,
                email: customer.email!.trim(),
              },
            ]),
        ).values(),
      )

      let sent = 0
      let failed = 0

      // Resend accepts a maximum of 100 emails per batch
      for (let i = 0; i < recipients.length; i += 100) {
        const batchRecipients = recipients.slice(i, i + 100)

        const { error } = await resend.batch.send(
          batchRecipients.map(customer => ({
            from: FROM_ADDRESS,
            to: customer.email,
            subject: `Bookings are open — ${cycleTitle}`,
            html: bookingOpenEmail(
              customer.full_name || 'there',
              cycleTitle,
              slaughterDate,
            ),
          })),
        )

        if (error) {
          console.error('Email batch failed:', {
            error,
            recipients: batchRecipients.map(customer => customer.email),
          })

          failed += batchRecipients.length
        } else {
          sent += batchRecipients.length
        }
      }

      if (sent === 0 && failed > 0) {
        return NextResponse.json(
          {
            error: 'All emails failed to send',
            sent: 0,
            failed,
          },
          { status: 502 },
        )
      }

      return NextResponse.json({
        sent,
        failed,
      })
    }

    // ── Order confirmation ──
    if (type === 'order_confirmation') {
      const { orderId } = body

      // 1. Validate the request shape — only orderId is accepted
      if (typeof orderId !== 'string' || orderId.trim() === '') {
        return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
      }
      const normalizedOrderId = orderId.trim()

      // 2. Require a logged-in user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      // 3. Fetch the order on the server
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(
          'id, user_id, cycle_id, order_number, recipient_name, payment_method, delivery_type, location_id, delivery_fee, total_amount',
        )
        .eq('id', normalizedOrderId)
        .single()

      if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      // 4. Authorise: owner of the order, or an admin
      const isOwner = order.user_id === user.id
      if (!isOwner) {
        const { data: callerProfile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        if (!callerProfile?.is_admin) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      // 5. Fetch the order owner's profile (name + trusted account email)
      const { data: ownerProfile, error: ownerError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', order.user_id)
        .single()

      if (ownerError || !ownerProfile) {
        return NextResponse.json({ error: 'Order owner not found' }, { status: 404 })
      }

      const ownerEmail = ownerProfile.email?.trim()
      if (!ownerEmail) {
        return NextResponse.json(
          { error: 'Order owner has no email on file' },
          { status: 422 },
        )
      }

      // 6. Fetch items, then variants and products separately (no nested-relationship guessing)
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('variant_id, quantity, subtotal')
        .eq('order_id', order.id)

      if (itemsError) {
        return NextResponse.json({ error: 'Could not load order items' }, { status: 500 })
      }

      // Never send a confirmation for an order with no items
      if (!orderItems || orderItems.length === 0) {
        return NextResponse.json({ error: 'Order has no items' }, { status: 422 })
      }

      const variantIds = Array.from(
        new Set(orderItems.map(i => i.variant_id).filter(Boolean)),
      )

      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, name, product_id')
        .in('id', variantIds)

      if (variantsError) {
        console.error('Order confirmation: failed to load product variants')
        return NextResponse.json({ error: 'Could not load order details' }, { status: 500 })
      }

      const productIds = Array.from(
        new Set((variants ?? []).map(v => v.product_id).filter(Boolean)),
      )

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds)

      if (productsError) {
        console.error('Order confirmation: failed to load products')
        return NextResponse.json({ error: 'Could not load order details' }, { status: 500 })
      }

      const variantById = new Map((variants ?? []).map(v => [v.id, v]))
      const productById = new Map((products ?? []).map(p => [p.id, p]))

      const items = orderItems.map(item => {
        const variant = variantById.get(item.variant_id)
        const product = variant ? productById.get(variant.product_id) : undefined
        return {
          name: product?.name ?? 'Item',
          variant: variant?.name ?? '',
          quantity: item.quantity,
          subtotal: item.subtotal,
        }
      })

      // 7. Fetch the cycle (title + slaughter date)
      const { data: cycle, error: cycleError } = await supabase
        .from('booking_cycles')
        .select('title, slaughter_date')
        .eq('id', order.cycle_id)
        .single()

      if (cycleError || !cycle) {
        console.error('Order confirmation: failed to load booking cycle')
        return NextResponse.json({ error: 'Could not load order details' }, { status: 500 })
      }

      // 8. Fetch the delivery location name only when relevant
      let deliveryLocation: string | null = null
      if (order.delivery_type === 'delivery' && order.location_id) {
        const { data: location, error: locationError } = await supabase
          .from('location_axes')
          .select('name')
          .eq('id', order.location_id)
          .single()

        if (locationError) {
          console.error('Order confirmation: failed to load delivery location')
          return NextResponse.json({ error: 'Could not load order details' }, { status: 500 })
        }

        deliveryLocation = location?.name ?? null
      }

      // 9. Build the email entirely from trusted server data, send only to the owner
      const { error: sendError } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: ownerEmail,
        subject: `Order confirmed — EDM${String(order.order_number).padStart(3, '0')} · Edible Mart`,
        html: orderConfirmationEmail({
          customerName: ownerProfile.full_name || 'there',
          recipientName: order.recipient_name,
          orderNumber: `EDM${String(order.order_number).padStart(3, '0')}`,
          cycleTitle: cycle.title,
          slaughterDate: cycle.slaughter_date
            ? format(new Date(cycle.slaughter_date), 'EEEE, MMMM do')
            : '',
          items,
          deliveryType: order.delivery_type,
          deliveryLocation,
          paymentMethod: order.payment_method,
          totalAmount: order.total_amount,
          deliveryFee: order.delivery_fee,
        }),
      })

      if (sendError) {
        console.error('Order confirmation: Resend failed to send email')
        return NextResponse.json(
          { error: 'Failed to send confirmation email' },
          { status: 502 },
        )
      }

      return NextResponse.json({ sent: 1 })
    }

    return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })

  } catch (error) {
    console.error('Email API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}