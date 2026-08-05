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
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ASSIGNABLE_PAYMENT_STATUS_OPTIONS,
  toAssignablePaymentStatus,
  getPaymentStatusPresentation,
  isOutstandingPaymentStatus,
  isSettledPaymentStatus,
} from "@/lib/payment-status";

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

type Cycle = {
  id: string;
  title: string;
  status: string;
  slaughter_date: string;
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

const paymentStatusOptions = ASSIGNABLE_PAYMENT_STATUS_OPTIONS;

type FilterType = "all" | "paid" | "unpaid" | "delivery" | "pickup";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    orderId: string;
    orderRef: string;
    action: "cancel" | "restore";
  }>({ open: false, orderId: "", orderRef: "", action: "cancel" });

  // Load all cycles on mount
  useEffect(() => {
    async function loadCycles() {
      const supabase = createClient();
      const { data } = await supabase
        .from("booking_cycles")
        .select("id, title, status, slaughter_date")
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        setCycles(data as Cycle[]);
        setSelectedCycleId(data[0].id); // default to latest
      }
    }
    loadCycles();
  }, []);

  // Load orders whenever selected cycle changes
  useEffect(() => {
    if (!selectedCycleId) return;

    async function loadOrders() {
      setLoading(true);
      const supabase = createClient();

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
        .eq("cycle_id", selectedCycleId)
        .order("order_number", { ascending: true });

      setOrders((data as AdminOrder[]) ?? []);
      setLoading(false);
    }

    loadOrders();
  }, [selectedCycleId]);

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

  // Explicit order-status transition. Only the status column is touched —
  // payment_status, total_amount, order_number and items are never changed.
  async function changeStatus(orderId: string, nextStatus: AdminOrder["status"]): Promise<boolean> {
    setUpdatingId(orderId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);

      if (error) {
        toast.error("Failed to update order status");
        return false;
      }

      toast.success("Order status updated");
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)),
      );
      return true;
    } catch (err) {
      console.error("Order status update error:", err);
      toast.error("Failed to update order status");
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  function orderRef(order: AdminOrder) {
    return `EDM${String(order.order_number).padStart(3, "0")}`;
  }

  async function runConfirmDialogAction() {
    const { orderId, action } = confirmDialog;
    const success = await changeStatus(
      orderId,
      action === "cancel" ? "cancelled" : "confirmed"
    );
    if (success) {
      setConfirmDialog((d) => ({ ...d, open: false }));
    }
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

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  // Cancelled orders never count toward paid/unpaid or delivery/pickup totals.
  // They remain visible under the "All" tab so admins can still find them.
  const activeOrders = orders.filter((o) => o.status !== "cancelled");

  const filtered = orders.filter((order) => {
    const matchesSearch =
      order.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
      order.profiles?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      `EDM${String(order.order_number).padStart(3, "0")}`
        .toLowerCase()
        .includes(search.toLowerCase());

    if (filter === "all") return matchesSearch;

    // Every non-"all" tab is a working list of live orders only.
    if (order.status === "cancelled") return false;

    const matchesFilter =
      filter === "paid"
        ? isSettledPaymentStatus(order.payment_status)
        : filter === "unpaid"
          ? isOutstandingPaymentStatus(order.payment_status)
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
      label: `Delivery (${activeOrders.filter((o) => o.delivery_type === "delivery").length})`,
    },
    {
      value: "pickup",
      label: `Pickup (${activeOrders.filter((o) => o.delivery_type === "pickup").length})`,
    },
    {
      value: "unpaid",
      label: `Unpaid (${activeOrders.filter((o) => isOutstandingPaymentStatus(o.payment_status)).length})`,
    },
    {
      value: "paid",
      label: `Paid (${activeOrders.filter((o) => isSettledPaymentStatus(o.payment_status)).length})`,
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
        <p className="text-sm text-muted-foreground">{orders.length} orders</p>
      </div>

      {/* ── Cycle selector ── */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Viewing cycle
        </p>
        <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
          <SelectTrigger className="h-10 max-w-sm">
            <SelectValue placeholder="Select a cycle" />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((cycle) => (
              <SelectItem key={cycle.id} value={cycle.id}>
                <div className="flex items-center gap-2">
                  <span>{cycle.title}</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      cycle.status === "open"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600",
                    )}
                  >
                    {cycle.status === "open" ? "Active" : "Closed"}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Past cycle warning — reminds admin they're editing a past cycle */}
        {selectedCycle && selectedCycle.status === "closed" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 max-w-sm">
            ⚠️ You are editing a <strong>closed</strong> cycle — changes here
            affect past order records
          </div>
        )}
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
            const paymentCfg = getPaymentStatusPresentation(
              order.payment_status,
            );
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
                          EDM{String(order.order_number).padStart(3, "0")}
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
                            paymentCfg.badgeClass,
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

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Order status
                        </p>
                        <OrderStatusActions
                          order={order}
                          isUpdating={isUpdating}
                          onAdvance={changeStatus}
                          onCancel={() =>
                            setConfirmDialog({
                              open: true,
                              orderId: order.id,
                              orderRef: orderRef(order),
                              action: "cancel",
                            })
                          }
                          onRestore={() =>
                            setConfirmDialog({
                              open: true,
                              orderId: order.id,
                              orderRef: orderRef(order),
                              action: "restore",
                            })
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Payment status
                        </p>
                        <Select
                          value={toAssignablePaymentStatus(
                            order.payment_status,
                          )}
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

                      <AdminNoteField
                        orderId={order.id}
                        initialNote={order.admin_notes ?? ""}
                        onSave={saveNote}
                      />
                    </div>

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

      {/* ── Cancel / Restore confirmation ── */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((d) => ({ ...d, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "cancel"
                ? "Cancel this order?"
                : "Restore this order?"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "cancel" ? (
                <>
                  Order{" "}
                  <span className="font-mono font-semibold">
                    {confirmDialog.orderRef}
                  </span>{" "}
                  will be marked cancelled. The order, its items and payment
                  record are kept, and stock is not restored.
                </>
              ) : (
                <>
                  Order{" "}
                  <span className="font-mono font-semibold">
                    {confirmDialog.orderRef}
                  </span>{" "}
                  will be restored to confirmed and counted again. Stock is not
                  deducted again.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() =>
                setConfirmDialog((d) => ({ ...d, open: false }))
              }
            >
              Keep as is
            </Button>
            <Button
              className={cn(
                "cursor-pointer",
                confirmDialog.action === "cancel" &&
                  "bg-red-600 hover:bg-red-700",
              )}
              onClick={runConfirmDialogAction}
              disabled={updatingId === confirmDialog.orderId}
            >
              {updatingId === confirmDialog.orderId && (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              )}
              {confirmDialog.action === "cancel"
                ? "Cancel order"
                : "Restore order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Explicit fulfilment actions driven by the current status + delivery type.
// The free-form status dropdown is gone; delivered is terminal.
function OrderStatusActions({
  order,
  isUpdating,
  onAdvance,
  onCancel,
  onRestore,
}: {
  order: AdminOrder;
  isUpdating: boolean;
  onAdvance: (orderId: string, next: string) => void;
  onCancel: () => void;
  onRestore: () => void;
}) {
  const isPickup = order.delivery_type !== "delivery";

  const advanceBtn = (label: string, next: string) => (
    <Button
      size="sm"
      className="h-9 text-xs cursor-pointer"
      onClick={() => onAdvance(order.id, next)}
      disabled={isUpdating}
    >
      {isUpdating && <Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" />}
      {label}
    </Button>
  );

  const cancelBtn = (
    <Button
      size="sm"
      variant="outline"
      className="h-9 text-xs cursor-pointer text-red-600 border-red-200 hover:bg-red-50"
      onClick={onCancel}
      disabled={isUpdating}
    >
      Cancel Order
    </Button>
  );

  if (order.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3" />
        Needs Review
      </span>
    );
  }

  if (order.status === "delivered") {
    return (
      <p className="text-xs text-muted-foreground">
        Delivered — no further action.
      </p>
    );
  }

  if (order.status === "cancelled") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-9 text-xs cursor-pointer"
          onClick={onRestore}
          disabled={isUpdating}
        >
          {isUpdating && (
            <Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" />
          )}
          Restore to Confirmed
        </Button>
      </div>
    );
  }

  if (order.status === "confirmed") {
    return <div className="flex flex-wrap gap-2">{cancelBtn}</div>;
  }

  if (order.status === "processing") {
    return (
      <div className="flex flex-wrap gap-2">
        {isPickup
          ? advanceBtn("Mark Ready", "ready")
          : advanceBtn("Mark Delivered", "delivered")}
        {cancelBtn}
      </div>
    );
  }

  if (order.status === "ready") {
    // ready + delivery is a review case — no automatic next step
    if (!isPickup) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3" />
          Needs Review
        </span>
      );
    }
    // ready + pickup → Mark Delivered and Cancel Order
    return (
      <div className="flex flex-wrap gap-2">
        {advanceBtn("Mark Delivered", "delivered")}
        {cancelBtn}
      </div>
    );
  }

  return null;
}

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
