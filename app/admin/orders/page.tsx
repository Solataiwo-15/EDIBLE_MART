"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type OrderItem = {
  id: string;
  quantity: number;
  subtotal: number;
  with_inu_eran: boolean;
  product_variants: {
    name: string;
    products: { name: string };
  };
};

type AdminOrder = {
  id: string;
  order_number: number;
  recipient_name: string;
  status: string;
  payment_method: string;
  payment_status: string;
  delivery_type: string;
  delivery_fee: number;
  total_amount: number;
  admin_notes: string | null;
  created_at: string;
  profiles: { full_name: string; phone: string | null };
  booking_cycles: { title: string; slaughter_date: string };
  location_axes: { name: string } | null;
  order_items: OrderItem[];
};

const statusOptions = [
  {
    value: "pending",
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  {
    value: "confirmed",
    label: "Confirmed",
    color: "bg-blue-100 text-blue-800",
    icon: CheckCircle2,
  },
  {
    value: "processing",
    label: "Processing",
    color: "bg-purple-100 text-purple-800",
    icon: Package,
  },
  {
    value: "ready",
    label: "Ready",
    color: "bg-green-100 text-green-800",
    icon: Package,
  },
  {
    value: "delivered",
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    icon: Truck,
  },
  {
    value: "cancelled",
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
];

const paymentStatusOptions = [
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
  { value: "pod_pending", label: "Unpaid", color: "bg-red-100 text-red-800" },
  {
    value: "pod_settled",
    label: "Settled",
    color: "bg-green-100 text-green-800",
  },
  { value: "waived", label: "Waived", color: "bg-gray-100 text-gray-600" },
];

type FilterType =
  | "all"
  | "paid"
  | "unpaid"
  | "delivery"
  | "pickup"
  | "pod_pending";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      const supabase = createClient();

      const { data: cycleData } = await supabase
        .from("booking_cycles")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!cycleData) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("orders")
        .select(
          `
        *,
        profiles ( full_name, phone ),
        booking_cycles ( title, slaughter_date ),
        location_axes ( name ),
        order_items (
          id, quantity, subtotal, with_inu_eran,
          product_variants (
            name,
            products ( name )
          )
        )
      `,
        )
        .eq("cycle_id", cycleData.id)
        .order("order_number", { ascending: true });

      setOrders((data as AdminOrder[]) ?? []);
      setLoading(false);
    }

    loadOrders();
  }, []);

  async function updateOrderStatus(
    orderId: string,
    field: "status" | "payment_status",
    value: string,
  ) {
    setUpdatingId(orderId);
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ [field]: value })
      .eq("id", orderId);

    if (error) {
      toast.error("Failed to update order");
    } else {
      toast.success("Order updated");
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, [field]: value } : o)),
      );
    }
    setUpdatingId(null);
  }

  async function saveNote(orderId: string, note: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({ admin_notes: note })
      .eq("id", orderId);
    if (error) toast.error("Failed to save note");
    else toast.success("Note saved");
  }

  // Apply filters
  const filtered = orders.filter((order) => {
    const matchesSearch =
      order.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
      order.profiles?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      `EDM${String(order.order_number).padStart(3, "0")}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesFilter =
      filter === "all"
        ? true
        : filter === "paid"
          ? order.payment_status === "paid" ||
            order.payment_status === "pod_settled"
          : filter === "unpaid"
            ? order.payment_status === "pod_pending"
            : filter === "pod_pending"
              ? order.payment_status === "pod_pending"
              : filter === "delivery"
                ? order.delivery_type === "delivery"
                : filter === "pickup"
                  ? order.delivery_type === "pickup"
                  : true;

    return matchesSearch && matchesFilter;
  });

  const filterTabs: { value: FilterType; label: string }[] = [
    { value: "all", label: `All (${orders.length})` },
    {
      value: "delivery",
      label: `Delivery (${orders.filter((o) => o.delivery_type === "delivery").length})`,
    },
    {
      value: "pickup",
      label: `Pickup (${orders.filter((o) => o.delivery_type === "pickup").length})`,
    },
    {
      value: "unpaid",
      label: `Unpaid (${orders.filter((o) => o.payment_status === "pod_pending").length})`,
    },
    {
      value: "paid",
      label: `Paid (${orders.filter((o) => o.payment_status === "paid" || o.payment_status === "pod_settled").length})`,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} orders this cycle
        </p>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer shrink-0",
              filter === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Orders list ── */}
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          No orders match this filter
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const statusCfg =
              statusOptions.find((s) => s.value === order.status) ??
              statusOptions[0];
            const paymentCfg =
              paymentStatusOptions.find(
                (p) => p.value === order.payment_status,
              ) ?? paymentStatusOptions[1];
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedId === order.id;
            const isUpdating = updatingId === order.id;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                {/* ── Order header ── */}
                <button
                  className="w-full text-left p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {order.recipient_name}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          #EDM{String(order.order_number).padStart(3, "0")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.profiles?.full_name} · {order.profiles?.phone} ·{" "}
                        {format(new Date(order.created_at), "MMM d, h:mm a")}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
                            statusCfg.color,
                          )}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {statusCfg.label}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-2 py-0.5 rounded-full",
                            paymentCfg.color,
                          )}
                        >
                          {paymentCfg.label}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
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

                {/* ── Expanded details ── */}
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

                    {/* Delivery */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        Collection
                      </p>
                      <p className="text-sm">
                        {order.delivery_type === "delivery"
                          ? `Delivery → ${order.location_axes?.name}`
                          : "Pickup"}
                      </p>
                      {order.delivery_fee > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Delivery fee: ₦{order.delivery_fee.toLocaleString()}
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* Admin controls */}
                    <div className="px-4 py-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Update order
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Order status */}
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Order status
                          </p>
                          <Select
                            value={order.status}
                            onValueChange={(v) =>
                              updateOrderStatus(order.id, "status", v)
                            }
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-xs"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Payment status */}
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Payment status
                          </p>
                          <Select
                            value={order.payment_status}
                            onValueChange={(v) =>
                              updateOrderStatus(order.id, "payment_status", v)
                            }
                            disabled={isUpdating}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {paymentStatusOptions.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-xs"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Admin notes */}
                      <AdminNoteField
                        orderId={order.id}
                        initialNote={order.admin_notes ?? ""}
                        onSave={saveNote}
                      />
                    </div>

                    {/* Total */}
                    <Separator />
                    <div className="px-4 py-3 flex justify-between font-bold text-sm">
                      <span>Total</span>
                      <span className="text-primary">
                        ₦{order.total_amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Admin note field with save button ── */
function AdminNoteField({
  orderId,
  initialNote,
  onSave,
}: {
  orderId: string;
  initialNote: string;
  onSave: (id: string, note: string) => void;
}) {
  const [note, setNote] = useState(initialNote);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Internal note</p>
      <div className="flex gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          className="h-9 text-xs flex-1"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-9 text-xs cursor-pointer shrink-0"
          onClick={() => onSave(orderId, note)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
