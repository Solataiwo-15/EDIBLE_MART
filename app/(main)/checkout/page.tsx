"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store/cart";
import { createClient } from "@/lib/supabase/client";
import { LocationAxis, BookingCycle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, User, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns/format";
import { profile } from "console";

type PaymentMethod = "bank_transfer" | "pay_on_delivery";
type DeliveryType = "delivery" | "pickup";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [locations, setLocations] = useState<LocationAxis[]>([]);
  const [cycle, setCycle] = useState<BookingCycle | null>(null);
  const [hasDebt, setHasDebt] = useState(false);

  const [recipientName, setRecipientName] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("pickup");
  const [locationId, setLocationId] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("bank_transfer");

  const selectedLocation = locations.find((l) => l.id === locationId);
  const deliveryFee =
    deliveryType === "delivery" ? (selectedLocation?.delivery_fee ?? 0) : 0;
  const grandTotal = total() + deliveryFee;

  useEffect(() => {
    if (items.length === 0) {
      router.replace("/cart");
      return;
    }

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setRecipientName(profileData?.full_name ?? "");
      setLocationId(profileData?.default_location_id ?? "");

      // Load locations
      const { data: locationData } = await supabase
        .from("location_axes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setLocations(locationData ?? []);

      // Load latest open cycle
      const { data: cycleData } = await supabase
        .from("booking_cycles")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setCycle(cycleData);

      // Check for unpaid debt
      const { data: debtOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("payment_status", "pod_pending")
        .limit(1);
      setHasDebt((debtOrders?.length ?? 0) > 0);

      setPageLoading(false);
    }
    load();
  }, []);

  async function handleSubmit() {
    if (!recipientName.trim()) {
      toast.error("Please enter a recipient name");
      return;
    }
    if (deliveryType === "delivery" && !locationId) {
      toast.error("Please select a delivery location");
      return;
    }
    if (!cycle) {
      toast.error("No active booking cycle found");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        cycle_id: cycle.id,
        recipient_name: recipientName.trim(),
        status: "pending",
        payment_method: paymentMethod,
        payment_status: "pod_pending",
        delivery_type: deliveryType,
        location_id: deliveryType === "delivery" ? locationId : null,
        delivery_fee: deliveryFee,
        total_amount: grandTotal,
      })
      .select()
      .single();

    if (orderError || !order) {
      toast.error("Failed to create order. Please try again.");
      setLoading(false);
      return;
    }

    // Insert order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      with_inu_eran: item.with_inu_eran,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      toast.error("Failed to save order items. Please try again.");
      setLoading(false);
      return;
    }

    // Confirm order
    await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", order.id);

    clearCart();
    // Send confirmation email
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const { sendOrderConfirmation } = await import("@/lib/email");
    await sendOrderConfirmation({
      customerEmail: authUser?.email ?? "",
      customerName: recipientName, // fallback to recipient name
      recipientName: recipientName.trim(),
      orderNumber: `EDM${String(order.order_number).padStart(3, "0")}`,
      cycleTitle: cycle.title,
      slaughterDate: format(new Date(cycle.slaughter_date), "EEEE, MMMM do"),
      items: items.map((i) => ({
        name: i.product_name,
        variant: i.variant_name,
        quantity: i.quantity,
        subtotal: i.price * i.quantity,
      })),
      deliveryType,
      deliveryLocation: selectedLocation?.name ?? null,
      paymentMethod,
      totalAmount: grandTotal,
      deliveryFee,
    });
    router.push(`/checkout/confirmation?order_id=${order.id}`);
  }

  if (pageLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-3">
        <p className="font-semibold">Bookings are currently closed</p>
        <p className="text-sm text-muted-foreground">
          You can&apos;t place an order right now. Check back soon.
        </p>
        <Link href="/">
          <Button variant="outline" className="cursor-pointer">
            Go home
          </Button>
        </Link>
      </div>
    );
  }

  // ── Debt wall — blocks checkout entirely ──
  if (hasDebt) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 space-y-6">
        <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
            <Wallet className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="font-bold text-base text-orange-900">
              You have a pending payment
            </h2>
            <p className="text-sm text-orange-800 mt-2 leading-relaxed">
              You have an unpaid balance from a previous order. Please clear it
              before placing a new one. Contact us on WhatsApp to settle your
              payment.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/orders">
              <Button className="w-full cursor-pointer">View my orders</Button>
            </Link>
            <Link href="/cart">
              <Button variant="outline" className="w-full cursor-pointer">
                Back to cart
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        href="/cart"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to cart
      </Link>

      <h1 className="text-xl font-bold">Checkout</h1>

      {/* ── Recipient ── */}
      <Section icon={User} title="Who is this order for?">
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient name</Label>
          <Input
            id="recipient"
            placeholder="e.g. Ahmad Taiwo or Ahmad mummy"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            This name will be written on your packaging label
          </p>
        </div>
      </Section>

      {/* ── Delivery or Pickup ── */}
      <Section icon={Truck} title="Delivery or pickup?">
        <div className="grid grid-cols-2 gap-3">
          {(["pickup", "delivery"] as DeliveryType[]).map((type) => (
            <button
              key={type}
              onClick={() => setDeliveryType(type)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors cursor-pointer",
                deliveryType === type
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/40",
              )}
            >
              <p
                className={cn(
                  "font-semibold text-sm capitalize",
                  deliveryType === type ? "text-primary" : "text-foreground",
                )}
              >
                {type}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {type === "pickup"
                  ? "Collect at our location"
                  : "Delivered to your door"}
              </p>
            </button>
          ))}
        </div>

        {deliveryType === "delivery" && (
          <div className="space-y-2 mt-4">
            <Label htmlFor="location">Delivery area</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location" className="h-11">
                <SelectValue placeholder="Select your area" />
              </SelectTrigger>
              <SelectContent>
                {locations
                  .filter((l) => l.delivery_fee > 0)
                  .map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} — +₦{loc.delivery_fee.toLocaleString()}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You can change this even if you picked a different area at signup
            </p>
          </div>
        )}
      </Section>

      {/* ── Payment ── */}
      <Section icon={Wallet} title="How would you like to pay?">
        <div className="space-y-2">
          {/* Bank transfer */}
          <PaymentOption
            value="bank_transfer"
            selected={paymentMethod === "bank_transfer"}
            onSelect={() => setPaymentMethod("bank_transfer")}
            label="Bank transfer"
            desc="Transfer to our account after placing order"
          />

          {/* Pay on delivery */}
          <PaymentOption
            value="pay_on_delivery"
            selected={paymentMethod === "pay_on_delivery"}
            onSelect={() => setPaymentMethod("pay_on_delivery")}
            label="Pay on delivery / pickup"
            desc="Pay cash when you receive or collect your order"
          />

          {/* Paystack — disabled until we integrate */}
          <div className="w-full rounded-xl border border-border p-4 opacity-40 cursor-not-allowed select-none">
            <p className="font-semibold text-sm text-foreground">
              Pay now (card / online)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Coming soon</p>
          </div>
        </div>
      </Section>

      {/* ── Total ── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Total</h2>
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Items subtotal</span>
          <span>₦{total().toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Delivery fee</span>
          <span>
            {deliveryFee > 0 ? `₦${deliveryFee.toLocaleString()}` : "—"}
          </span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span className="text-primary">₦{grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Submit ── */}
      <div className="pb-4">
        <Button
          className="w-full h-13 text-[15px] rounded-2xl py-4 cursor-pointer"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Placing order..." : "Review & confirm order"}
        </Button>
      </div>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );
}

/* ── Payment option button ── */
function PaymentOption({
  value,
  selected,
  onSelect,
  label,
  desc,
}: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors cursor-pointer",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "font-semibold text-sm",
            selected ? "text-primary" : "text-foreground",
          )}
        >
          {label}
        </p>
        {selected && (
          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}
