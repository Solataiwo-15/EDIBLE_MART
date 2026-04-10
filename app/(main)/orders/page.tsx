"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/lib/store/cart";
import { Badge } from "@/components/ui/badge";
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

const paymentConfig: Record<string, { label: string; color: string }> = {
  paid: { label: "Paid", color: "bg-green-100 text-green-800" },
  pod_pending: { label: "Unpaid", color: "bg-red-100 text-red-800" },
  pod_settled: { label: "Settled", color: "bg-green-100 text-green-800" },
  waived: { label: "Waived", color: "bg-gray-100 text-gray-600" },
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const hasDebt = orders.some((o) => o.payment_status === "pod_pending");

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

  function handleRebook(order: OrderWithDetails) {
    clearCart();
    order.order_items.forEach((item) => {
      addItem({
        variant_id: item.product_variants.id,
        product_name: item.product_variants.products.name,
        variant_name:
          item.product_variants.name +
          (item.with_inu_eran ? " + Inu Eran" : ""),
        price: item.product_variants.price,
        quantity: item.quantity,
        with_inu_eran: item.with_inu_eran,
      });
    });
    toast.success("Items added to cart — ready to rebook!");
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
          const payment =
            paymentConfig[order.payment_status] ?? paymentConfig.pod_pending;
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
                          payment.color,
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
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Rebook this order
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
