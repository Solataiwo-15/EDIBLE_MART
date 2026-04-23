# Edible Mart v2

A full-stack beef booking platform built for a weekly beef sales business. Customers browse products, book slots before slaughter day, and track their order history — all from a mobile-first web app. Admins manage the full business cycle from a dedicated dashboard.

**Live app:** [edible-mart-v2.vercel.app](https://edible-mart-v2.vercel.app)

---

## What it does

The business buys a cow every 1–2 weeks, slaughters it on Saturday, and sells the parts as pre-booked slots. Before this app, bookings were managed manually over WhatsApp with no order history, no stock visibility, and no debt tracking.

**This app replaces that entirely.**

---

## Tech stack

| Layer      | Technology                        |
| ---------- | --------------------------------- |
| Framework  | Next.js 16 (App Router)           |
| Language   | TypeScript                        |
| Styling    | Tailwind CSS + shadcn/ui          |
| Database   | Supabase (PostgreSQL)             |
| Auth       | Supabase Auth (email + password)  |
| Storage    | Supabase Storage (product images) |
| State      | Zustand (cart persistence)        |
| Email      | Resend                            |
| PDF        | jsPDF (client-side generation)    |
| Deployment | Vercel                            |

---

## Features

### Customer side

- **Account creation** — sign up with name, email, phone, and delivery area selection
- **Email verification** — branded confirmation email on signup with resend option
- **Mobile-first product browsing** — image cards with live stock badges (green → orange as slots deplete)
- **Smart stock display** — full slots and half slots share one pool; half slot count is derived (5 full slots = 10 half slots available)
- **Inu Eran combo toggle** — split any full slot with Inu Eran at no extra cost, auto-deducted from both pools
- **Cart** — persisted in localStorage via Zustand, survives page refresh
- **Checkout** — recipient name (for family orders), delivery/pickup toggle, location selector with fee preview, payment method selection
- **Debt wall** — customers with unpaid previous orders are blocked from checkout entirely until cleared
- **Pay on delivery blocked for debtors** — POD is unavailable if any order has `pod_pending` status
- **Order confirmation** — branded page with bank transfer details and copy-to-clipboard
- **My Orders** — full order history per cycle, expandable cards with items, delivery info and payment status
- **One-tap rebook** — loads all items from a past order into cart in one click
- **Forgot password** — branded reset email with 1-hour expiry link
- **Email notifications** — booking-open blast, order confirmation, password reset — all branded

### Admin side

- **Dashboard** — live stats: total orders, revenue, unpaid count, delivery vs pickup breakdown, recent orders
- **Cycle manager** — create cycles with title, slaughter date, and order limit; manually open/close bookings; send email blast to all customers on open
- **Orders** — filterable by All, Delivery, Pickup, Paid, Unpaid; search by name or order ID; inline status and payment status update; internal notes per order
- **Products & Pricing** — update prices per variant, set stock per cycle (half slot stock is derived automatically), upload product images directly to Supabase Storage, show/hide individual variants or entire products
- **Customers** — full list with debt status badge, expandable order history per customer, total spent
- **Locations** — add/edit/deactivate delivery areas with individual fees
- **Cycle History** — all past cycles with stats, full order list per cycle, PDF report download
- **PDF reports** — branded A4 report with stats summary, full orders table with payment status coloring, grand total

---

## Database schema

```
profiles          — one per auth user, stores name/phone/location/is_admin/email
location_axes     — delivery areas with fees
booking_cycles    — each booking window with status, limit, order counter
products          — beef cuts and special parts with images
product_variants  — half slot/full slot/standard with prices
cycle_stock       — stock per variant per cycle (full-slot units, single source of truth)
orders            — one per recipient per cycle, with payment/delivery/status tracking
order_items       — line items with price snapshot and inu_eran flag
```

### Key design decisions

**Stock is stored in full-slot units.** Both the Full Slot and Half Slot variants of a product share one `cycle_stock` row keyed to the Full Slot variant. The trigger always deducts from the full slot pool — half slot orders deduct 0.5, full slot orders deduct 1.0. The frontend multiplies remaining by 2 to display half slot availability.

**Price snapshots in order_items.** `unit_price` is copied at order time so historical PDF reports remain accurate even after price changes.

**Atomic order numbers.** Each cycle has a `last_order_number` counter. A BEFORE INSERT trigger atomically increments it and assigns the value — no race conditions between concurrent orders.

**RLS everywhere.** Row Level Security is enabled on all tables. Customers can only read/write their own data. An `is_admin()` helper function gates all admin operations. Stock deduction triggers use `SECURITY DEFINER` to bypass RLS safely.

---

## Project structure

```
app/
  (auth)/
    login/          — sign in
    signup/         — create account
    forgot-password/
    reset-password/
    verify-email/
  (main)/           — customer app (requires auth)
    page.tsx        — home / booking status
    products/       — product browsing
    cart/
    checkout/
      confirmation/
    orders/         — order history
  admin/            — admin dashboard (requires is_admin)
    page.tsx        — overview stats
    orders/
    products/
    cycles/
    customers/
    locations/
    history/
  api/
    email/          — Resend email API route

components/
  layout/
    MainNav.tsx     — top header + mobile bottom tab bar
  admin/
    AdminNav.tsx    — dark top bar + sidebar

lib/
  supabase/
    client.ts       — browser client
    server.ts       — server client
  store/
    cart.ts         — Zustand cart store
  email.ts          — email helper functions
  types.ts          — shared TypeScript types
  utils.ts          — cn() utility
```

---

## Local development

### Prerequisites

- Node.js 18+
- A Supabase project
- A Resend account (free tier works)

### Setup

```bash
# Clone and install
git clone https://github.com/Solataiwo-15/EDIBLE_MART
cd edible-mart-v2
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database setup

Run the migration files in order in the Supabase SQL Editor:

1. `schema_migration_v3.sql` — all tables, enums, indexes, triggers
2. `rls_policies.sql` — Row Level Security policies

Then make your account an admin:

```sql
UPDATE profiles SET is_admin = TRUE WHERE id = 'your-user-uuid';
```

Set up your first booking cycle stock:

```sql
INSERT INTO cycle_stock (cycle_id, variant_id, stock_slots)
SELECT
  (SELECT id FROM booking_cycles ORDER BY created_at DESC LIMIT 1),
  id,
  CASE
    WHEN name ILIKE '%full slot%' OR name = 'Full' OR name = 'Standard' THEN 10
    ELSE 0
  END
FROM product_variants
WHERE name NOT ILIKE '%half slot%' AND name != 'Half';
```

---

## Deployment

The app is deployed on Vercel. Push to `main` and Vercel deploys automatically.

Add all `.env.local` variables to your Vercel project under **Settings → Environment Variables**.

In Supabase:

- Go to **Authentication → URL Configuration** and add your Vercel URL to Redirect URLs: `https://your-app.vercel.app/**`
- Go to **Authentication → Email Templates** and update Confirm Signup and Reset Password templates with your branded HTML

---

## Email templates

Two Supabase email templates need to be customized (branded HTML is in the project):

- **Confirm signup** — subject: `Confirm your Edible Mart account`
- **Reset password** — subject: `Reset your Edible Mart password`

The booking-open blast and order confirmation emails are sent via the `/api/email` route using Resend.

---

## Built by

[Ahmad Taiwo](https://www.linkedin.com/in/ahmad-taiwo/) — Software Engineer
