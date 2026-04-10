import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = process.env.FROM_EMAIL ?? 'onboarding@resend.dev'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const BANK_ACCOUNT = '0043750696'
const BANK_NAME = 'Access Bank'
const ACCOUNT_NAME = 'TMC'

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
        ${i.name} (${i.variant}) × ${i.quantity}
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
        <p style="margin:0 0 24px;color:#666;font-size:15px;">Hi ${customerName}, your order has been placed.</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:12px;margin-bottom:24px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 2px;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Order ref</p>
              <p style="margin:0;color:#1C0A06;font-size:20px;font-weight:bold;">${orderNumber}</p>
            </td>
            <td style="padding:16px 20px;text-align:right;">
              <p style="margin:0 0 2px;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Cycle</p>
              <p style="margin:0;color:#333;font-size:14px;font-weight:bold;">${cycleTitle}</p>
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
            <p style="margin:0 0 8px;color:#333;font-size:14px;"><strong>Recipient:</strong> ${recipientName}</p>
            <p style="margin:0 0 8px;color:#333;font-size:14px;"><strong>Collection:</strong> ${deliveryType === 'delivery' ? `Delivery — ${deliveryLocation}` : 'Pickup'}</p>
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

      // Get all customers with their stored emails
      const { data: customers } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('is_admin', false)
        .not('email', 'is', null)

      if (!customers || customers.length === 0) {
        return NextResponse.json({ sent: 0, message: 'No customers with emails found' })
      }

      let sent = 0
      const errors: string[] = []

      for (const customer of customers) {
        if (!customer.email) continue
        try {
          await resend.emails.send({
            from: FROM_ADDRESS,
            to: customer.email,
            subject: `🥩 Bookings are open — ${cycleTitle}`,
            html: bookingOpenEmail(customer.full_name, cycleTitle, slaughterDate),
          })
          sent++
          await new Promise(r => setTimeout(r, 50)) // avoid rate limits
        } catch {
          errors.push(customer.email)
        }
      }

      return NextResponse.json({ sent, errors: errors.length })
    }

    // ── Order confirmation ──
    if (type === 'order_confirmation') {
      const { customerEmail, ...rest } = body

      await resend.emails.send({
        from: FROM_ADDRESS,
        to: customerEmail,
        subject: `Order confirmed — ${rest.orderNumber} · Edible Mart`,
        html: orderConfirmationEmail(rest),
      })

      return NextResponse.json({ sent: 1 })
    }

    return NextResponse.json({ error: 'Unknown email type' }, { status: 400 })

  } catch (error) {
    console.error('Email API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}