"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, User, Truck, Wallet, Copy } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

type OrderDetail = {
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
  location_id: string | null;
  booking_cycles: {
    title: string;
    slaughter_date: string;
  };
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    with_inu_eran: boolean;
    product_variants: {
      name: string;
      products: {
        name: string;
      };
    };
  }[];
  location_axes: {
    name: string;
    delivery_fee: number;
  } | null;
};

const BANK_ACCOUNT = "0043750696";
const BANK_NAME = "Access Bank";
const ACCOUNT_NAME = "TMC";

export default function ConfirmationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("order_id");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      router.replace("/");
      return;
    }
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          booking_cycles ( title, slaughter_date ),
          location_axes ( name, delivery_fee ),
          order_items (
            id, quantity, unit_price, subtotal, with_inu_eran,
            product_variants (
              name,
              products ( name )
            )
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (error || !data) {
        router.replace("/");
        return;
      }
      setOrder(data as OrderDetail);
      setLoading(false);
    }
    load();
  }, [orderId]);

  function copyAccountDetails() {
    navigator.clipboard.writeText(
      `${BANK_ACCOUNT} — ${BANK_NAME} (${ACCOUNT_NAME})`,
    );
    toast.success("Account details copied!");
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) return null;

  const isBankTransfer = order.payment_method === "bank_transfer";
  const isPOD = order.payment_method === "pay_on_delivery";
  const subtotal = order.total_amount - order.delivery_fee;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* ── Success header ── */}
      <div className="flex flex-col items-center text-center py-4 space-y-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Order confirmed!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {order.booking_cycles.title} • Slaughter{" "}
            {format(
              new Date(order.booking_cycles.slaughter_date),
              "EEE, MMM do",
            )}
          </p>
        </div>
        <Badge className="bg-green-600 hover:bg-green-600 text-white">
          #EDM{String(order.order_number).padStart(3, "0")}
        </Badge>
      </div>

      {/* ── Bank transfer instructions ── */}
      {isBankTransfer && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-3">
          <p className="font-semibold text-sm text-amber-900">
            Transfer payment to complete your order
          </p>
          <div className="bg-white rounded-xl p-4 space-y-1 border border-amber-100">
            <p className="text-xs text-muted-foreground">Account number</p>
            <p className="font-bold text-lg tracking-wider">{BANK_ACCOUNT}</p>
            <p className="text-sm text-muted-foreground">
              {BANK_NAME} — {ACCOUNT_NAME}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full cursor-pointer gap-2 border-amber-300 text-amber-900 hover:bg-amber-100"
            onClick={copyAccountDetails}
          >
            <Copy className="w-4 h-4" />
            Copy account details
          </Button>
          <p className="text-xs text-amber-800">
            After transferring, send your payment screenshot to us on WhatsApp.
            Your order is reserved.
          </p>
        </div>
      )}

      {/* ── POD note ── */}
      {isPOD && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          Pay on delivery selected — please have the exact amount ready when
          collecting your order.
        </div>
      )}

      {/* ── Order details ── */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {/* Items */}
        <div className="p-5 space-y-4">
          <h2 className="font-semibold text-sm">Items ordered</h2>
          <div className="space-y-3">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">
                    {item.product_variants.products.name}
                    {item.with_inu_eran ? " + Inu Eran" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.product_variants.name} × {item.quantity}
                  </p>
                </div>
                <p className="font-medium shrink-0 ml-4">
                  ₦{item.subtotal.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Recipient */}
        <div className="px-5 py-4 flex items-center gap-3">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Recipient</p>
            <p className="text-sm font-medium">{order.recipient_name}</p>
          </div>
        </div>

        {/* Delivery */}
        <div className="px-5 py-4 flex items-center gap-3">
          <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Collection</p>
            <p className="text-sm font-medium capitalize">
              {order.delivery_type === "delivery"
                ? `Delivery — ${order.location_axes?.name}`
                : "Pickup"}
            </p>
          </div>
        </div>

        {/* Payment */}
        <div className="px-5 py-4 flex items-center gap-3">
          <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <p className="text-sm font-medium capitalize">
              {order.payment_method === "bank_transfer"
                ? "Bank transfer"
                : order.payment_method === "pay_on_delivery"
                  ? "Pay on delivery"
                  : "Paid online"}
            </p>
          </div>
        </div>

        {/* Total */}
        <div className="px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Items</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span>₦{order.delivery_fee.toLocaleString()}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">
              ₦{order.total_amount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="space-y-3 pb-4">
        <Link href="/orders">
          <Button className="w-full h-12 rounded-2xl cursor-pointer">
            View my orders
          </Button>
        </Link>
        <Link href="/products">
          <Button
            variant="outline"
            className="w-full h-11 rounded-2xl cursor-pointer mt-2"
          >
            Continue shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
