"use client";

import { useState, useEffect, useRef } from "react";
import type { CartItem, Product, ProductVariant } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  countsTowardOutstanding,
  getPaymentStatusPresentation,
} from "@/lib/payment-status";

type OrderWithDetails = {
  id: string;
  order_number: number;
  recipient_name: string;
  status: string;
  payment_method: string;
  payment_status: string;
  delivery_type: string;
  delivery_fee: number;
  total_amount: number;
  created_at: string;
  booking_cycles: { title: string; slaughter_date: string };
  location_axes: { name: string } | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    with_inu_eran: boolean;
    product_variants: {
      id: string;
      name: string;
      price: number;
      products: { name: string };
    };
  }[];
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    color: "bg-purple-100 text-purple-800",
    icon: Package,
  },
  ready: {
    label: "Ready",
    color: "bg-green-100 text-green-800",
    icon: Package,
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    icon: Truck,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const rebookInFlight = useRef(false);
  const [rebookingId, setRebookingId] = useState<string | null>(null);

  const hasDebt = orders.some(countsTowardOutstanding);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("orders")
        .select(
          `
        *,
        booking_cycles ( title, slaughter_date ),
        location_axes ( name ),
        order_items (
          id, quantity, unit_price, subtotal, with_inu_eran,
          product_variants (
            id, name, price,
            products ( name )
          )
        )
      `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((data as OrderWithDetails[]) ?? []);
      setLoading(false);
    }
    loadOrders();
  }, []);

  async function handleRebook(order: OrderWithDetails) {
    if (rebookInFlight.current) return;

    rebookInFlight.current = true;
    setRebookingId(order.id);

    const rebookItems: CartItem[] = [];
    const notices: string[] = [];

    try {
      const supabase = createClient();

      // Match the products page: inspect the latest cycle.
      const { data: cycle, error: cycleError } = await supabase
        .from("booking_cycles")
        .select("id, status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleError) throw cycleError;

      if (!cycle || cycle.status !== "open") {
        toast.error("Bookings are closed right now.");
        return;
      }

      // Fetch fresh availability, prices, and all sibling variants
      // needed to identify each product's shared stock pool.
      const [productsResult, stockResult] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, name, category, is_available, product_variants(id, product_id, name, price, is_available)",
          )
          .eq("is_available", true),
        supabase
          .from("cycle_stock_remaining")
          .select("variant_id, remaining_slots")
          .eq("cycle_id", cycle.id),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (stockResult.error) throw stockResult.error;

      type RebookProduct = Pick<
        Product,
        "id" | "name" | "category" | "is_available"
      > & {
        product_variants: ProductVariant[];
      };

      const products =
        (productsResult.data as RebookProduct[] | null) ?? [];

      const variantLookup = new Map<
        string,
        { product: RebookProduct; variant: ProductVariant }
      >();

      for (const product of products) {
        for (const variant of product.product_variants) {
          variantLookup.set(variant.id, { product, variant });
        }
      }

      // Mutable local budget prevents multiple historical items from
      // independently consuming the same Full/Half Slot stock.
      const remainingByPool = new Map<string, number>();

      for (const stock of stockResult.data ?? []) {
        const remaining = Number(stock.remaining_slots);
        remainingByPool.set(
          stock.variant_id,
          Number.isFinite(remaining) ? Math.max(0, remaining) : 0,
        );
      }

      for (const item of order.order_items) {
        const oldVariant = item.product_variants;
        const label = oldVariant
          ? `${oldVariant.products?.name ?? "Product"} (${oldVariant.name})`
          : "An item from this order";

        const current = oldVariant
          ? variantLookup.get(oldVariant.id)
          : undefined;

        if (
          !current ||
          !current.product.is_available ||
          !current.variant.is_available
        ) {
          notices.push(`${label}: skipped — product or variant unavailable.`);
          continue;
        }

        const { product, variant } = current;
        const variants = product.product_variants.filter(
          (candidate) => candidate.is_available,
        );

        // Same pool selection as ProductCard.
        const fullSlotVariant =
          variants.find(
            (candidate) =>
              candidate.name.toLowerCase().includes("full slot") ||
              candidate.name.toLowerCase() === "full" ||
              candidate.name.toLowerCase() === "standard",
          ) ?? variants[0];

        if (
          !fullSlotVariant ||
          !remainingByPool.has(fullSlotVariant.id)
        ) {
          notices.push(`${label}: skipped — stock unavailable for this cycle.`);
          continue;
        }

        const poolRemaining = remainingByPool.get(fullSlotVariant.id)!;
        const isHalfSlot =
          variant.name.toLowerCase().includes("half slot") ||
          variant.name.toLowerCase() === "half";

        const availableQuantity = Math.floor(
          isHalfSlot ? poolRemaining * 2 : poolRemaining,
        );

        if (availableQuantity <= 0) {
          notices.push(`${label}: skipped — no stock remaining.`);
          continue;
        }

        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          notices.push(`${label}: skipped — invalid order quantity.`);
          continue;
        }

        const quantity = Math.min(item.quantity, availableQuantity);
        const withInuEran = item.with_inu_eran;

        if (quantity < item.quantity) {
          notices.push(
            `${label}: reduced from ${item.quantity} to ${quantity} ` +
            "due to remaining stock.",
          );
        }

        rebookItems.push({
          variant_id: variant.id,
          product_name: product.name,
          variant_name: variant.name + (withInuEran ? " + Inu Eran" : ""),
          price: variant.price,
          quantity,
          with_inu_eran: withInuEran,
        });

        remainingByPool.set(
          fullSlotVariant.id,
          Math.max(0, poolRemaining - quantity * (isHalfSlot ? 0.5 : 1)),
        );
      }

      if (rebookItems.length === 0) {
        toast.error("None of the items in this order are currently available.");
        return;
      }
    } catch (error) {
      console.error("Failed to check Rebook availability:", error);
      toast.error("Couldn't check current availability. Please try again.", {
        description: "Your existing cart has been kept.",
      });
      return;
    } finally {
      rebookInFlight.current = false;
      setRebookingId(null);
    }

    // All reads and item preparation succeeded, with at least one valid item.
    clearCart();
    rebookItems.forEach((item) => addItem(item));

    if (notices.length > 0) {
      toast.warning(
        "Available items were added to your cart. Some items were unavailable or adjusted."
      );
    } else {
      toast.success("Items added to cart — ready to rebook!");
    }

    router.push("/cart");
  }

  if (loading) return <OrdersSkeleton />;

  if (orders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ClipboardList className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No orders yet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your order history will appear here after your first booking
          </p>
        </div>
        <Button
          className="cursor-pointer mt-2"
          onClick={() => router.push("/products")}
        >
          Browse products
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold">My orders</h1>

      {/* ── Debt banner ── */}
      {hasDebt && (
        <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-900">
              You have a pending payment
            </p>
            <p className="text-sm text-orange-800 mt-0.5 leading-relaxed">
              One or more of your previous orders are unpaid. Please contact us
              on WhatsApp to settle before placing a new order.
            </p>
          </div>
        </div>
      )}

      {/* ── Orders list ── */}
      <div className="space-y-3">
        {orders.map((order) => {
          const status = statusConfig[order.status] ?? statusConfig.pending;
          const payment = getPaymentStatusPresentation(order.payment_status);
          const StatusIcon = status.icon;
          const isExpanded = expandedId === order.id;

          return (
            <div
              key={order.id}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              {/* Order header — always visible */}
              <button
                className="w-full text-left p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {order.booking_cycles.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        #EDM{String(order.order_number).padStart(3, "0")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.recipient_name} ·{" "}
                      {format(new Date(order.created_at), "MMM d, yyyy")}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {/* Status badge */}
                      <span
                        className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                          status.color,
                        )}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {/* Payment badge */}
                      <span
                        className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full",
                          payment.badgeClass,
                        )}
                      >
                        {payment.label}
                      </span>
                      {/* Delivery badge */}
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                        {order.delivery_type}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="font-bold text-sm text-primary">
                      ₦{order.total_amount.toLocaleString()}
                    </p>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Items */}
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Items
                    </p>
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {item.product_variants.products.name}
                          {item.with_inu_eran ? " + Inu Eran" : ""}{" "}
                          <span className="text-xs">
                            ({item.product_variants.name})
                          </span>{" "}
                          × {item.quantity}
                        </span>
                        <span className="font-medium shrink-0 ml-2">
                          ₦{item.subtotal.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Delivery info */}
                  <div className="px-4 py-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Collection
                    </p>
                    <p className="text-sm">
                      {order.delivery_type === "delivery"
                        ? `Delivery — ${order.location_axes?.name}`
                        : "Pickup"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Slaughter day:{" "}
                      {format(
                        new Date(order.booking_cycles.slaughter_date),
                        "EEEE, MMMM do",
                      )}
                    </p>
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Items</span>
                      <span>
                        ₦
                        {(
                          order.total_amount - order.delivery_fee
                        ).toLocaleString()}
                      </span>
                    </div>
                    {order.delivery_fee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Delivery fee
                        </span>
                        <span>₦{order.delivery_fee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm pt-1">
                      <span>Total</span>
                      <span className="text-primary">
                        ₦{order.total_amount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Rebook button */}
                  <div className="px-4 py-3">
                    <Button
                      variant="outline"
                      className="w-full cursor-pointer gap-2 h-10"
                      onClick={() => handleRebook(order)}
                      disabled={rebookingId !== null}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {rebookingId === order.id
                        ? "Checking availability..."
                        : "Rebook this order"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-7 w-32" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
