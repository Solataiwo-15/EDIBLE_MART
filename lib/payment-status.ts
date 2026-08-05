/**
 * Single source of truth for payment-status semantics.
 *
 * A payment status is either *settled* (money is considered received) or
 * *outstanding* (money is still owed). `waived` is settled: management has
 * financially settled the order, so it behaves exactly like money received.
 *
 * These two classifications drive payment badges, debt checks, paid/unpaid
 * filters, and outstanding totals. They do **not** determine revenue.
 *
 * Revenue is the total value of every non-cancelled order, regardless of
 * payment status — an unpaid active order is still revenue. Cancellation is
 * tracked separately on `orders.status`, never encoded in `payment_status`,
 * and is the only thing that removes an order from revenue.
 */

export type PaymentStatus =
  | 'paid'
  | 'pending'
  | 'pod_pending'
  | 'pod_settled'
  | 'waived'

/**
 * Money received, or treated as received. Drives paid badges and the paid
 * filter — not revenue, which counts active orders regardless of payment.
 */
export const SETTLED_PAYMENT_STATUSES = [
  'paid',
  'pod_settled',
  'waived',
] as const satisfies readonly PaymentStatus[]

/**
 * Money still owed. `pod_pending` is the legacy value; `pending` is its
 * replacement. Both are outstanding for the duration of the migration.
 */
export const OUTSTANDING_PAYMENT_STATUSES = [
  'pending',
  'pod_pending',
] as const satisfies readonly PaymentStatus[]

/**
 * Payment statuses an admin may assign. `pod_pending` is deliberately absent —
 * it is a legacy value that is still read and displayed, but never written to
 * a new order or selected from the admin dropdown. Selecting "Unpaid" writes
 * `pending`.
 */
export const ASSIGNABLE_PAYMENT_STATUSES = [
  'paid',
  'pending',
  'pod_settled',
  'waived',
] as const satisfies readonly PaymentStatus[]

export function isSettledPaymentStatus(status: string | null | undefined) {
  return SETTLED_PAYMENT_STATUSES.includes(status as never)
}

export function isOutstandingPaymentStatus(status: string | null | undefined) {
  return OUTSTANDING_PAYMENT_STATUSES.includes(status as never)
}

/** An order still counts toward active totals unless it was cancelled. */
export function isActiveOrderStatus(status: string | null | undefined) {
  return status !== 'cancelled'
}

/**
 * Counts toward revenue: every non-cancelled order, regardless of payment_status.
 *
 * Revenue is the total value of active orders. Whether the payment is settled or
 * outstanding does not determine whether an order counts — only cancellation excludes
 * an order from revenue.
 */
export function countsTowardRevenue(order: {
  status?: string | null
  payment_status?: string | null
}) {
  return isActiveOrderStatus(order.status)
}

/** Counts toward outstanding balance: not cancelled, and unpaid. */
export function countsTowardOutstanding(order: {
  status?: string | null
  payment_status?: string | null
}) {
  return (
    isActiveOrderStatus(order.status) &&
    isOutstandingPaymentStatus(order.payment_status)
  )
}

type PaymentStatusPresentation = {
  label: string
  /** Tailwind classes for a filled badge. */
  badgeClass: string
  /** RGB triple for the jsPDF cycle report. */
  pdfColor: [number, number, number]
}

const SETTLED_BADGE = 'bg-green-100 text-green-800'
const OUTSTANDING_BADGE = 'bg-red-100 text-red-800'
const SETTLED_PDF_COLOR: [number, number, number] = [30, 130, 70]
const OUTSTANDING_PDF_COLOR: [number, number, number] = [200, 50, 50]

/**
 * Display metadata per status. `pending` and `pod_pending` deliberately share
 * the "Unpaid" label — customers and admins should not see two different
 * words for the same financial state.
 */
const PAYMENT_STATUS_PRESENTATION: Record<
  PaymentStatus,
  PaymentStatusPresentation
> = {
  paid: {
    label: 'Paid',
    badgeClass: SETTLED_BADGE,
    pdfColor: SETTLED_PDF_COLOR,
  },
  pending: {
    label: 'Unpaid',
    badgeClass: OUTSTANDING_BADGE,
    pdfColor: OUTSTANDING_PDF_COLOR,
  },
  pod_pending: {
    label: 'Unpaid',
    badgeClass: OUTSTANDING_BADGE,
    pdfColor: OUTSTANDING_PDF_COLOR,
  },
  pod_settled: {
    label: 'Settled',
    badgeClass: SETTLED_BADGE,
    pdfColor: SETTLED_PDF_COLOR,
  },
  // Waived is settled money, so it reads as success like Paid and Settled.
  waived: {
    label: 'Waived',
    badgeClass: SETTLED_BADGE,
    pdfColor: SETTLED_PDF_COLOR,
  },
}

/** Unknown values fall back to Unpaid — never silently render as settled. */
export function getPaymentStatusPresentation(
  status: string | null | undefined,
): PaymentStatusPresentation {
  return (
    PAYMENT_STATUS_PRESENTATION[status as PaymentStatus] ??
    PAYMENT_STATUS_PRESENTATION.pod_pending
  )
}

export function getPaymentStatusLabel(status: string | null | undefined) {
  return getPaymentStatusPresentation(status).label
}

/** Options for the admin payment dropdown, in display order. */
export const ASSIGNABLE_PAYMENT_STATUS_OPTIONS = ASSIGNABLE_PAYMENT_STATUSES.map(
  (value) => ({
    value,
    label: PAYMENT_STATUS_PRESENTATION[value].label,
    color: PAYMENT_STATUS_PRESENTATION[value].badgeClass,
  }),
)

/**
 * Maps a stored payment status onto the value the admin dropdown should show
 * as selected. Legacy `pod_pending` orders normalize to `pending` so the
 * control never renders an option that is not in the list — the stored value
 * is untouched until an admin actively changes it.
 */
export function toAssignablePaymentStatus(
  status: string | null | undefined,
): PaymentStatus {
  if (status === 'pod_pending') return 'pending'
  return ASSIGNABLE_PAYMENT_STATUSES.includes(status as never)
    ? (status as PaymentStatus)
    : 'pending'
}
