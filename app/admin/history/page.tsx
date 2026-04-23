"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Download,
  CalendarDays,
  Users,
  TrendingUp,
  Truck,
  ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type CycleOrder = {
  id: string;
  order_number: number;
  recipient_name: string;
  payment_method: string;
  payment_status: string;
  delivery_type: string;
  delivery_fee: number;
  total_amount: number;
  profiles: { full_name: string; phone: string | null };
  location_axes: { name: string } | null;
  order_items: {
    quantity: number;
    subtotal: number;
    with_inu_eran: boolean;
    product_variants: {
      name: string;
      products: { name: string };
    };
  }[];
};

type CycleHistory = {
  id: string;
  title: string;
  status: string;
  slaughter_date: string;
  order_limit: number;
  current_orders: number;
  created_at: string;
  orders?: CycleOrder[];
  loaded?: boolean;
};

export default function AdminHistoryPage() {
  const [cycles, setCycles] = useState<CycleHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("booking_cycles")
        .select("*")
        .order("created_at", { ascending: false });
      setCycles((data as CycleHistory[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function loadCycleOrders(cycleId: string) {
    const existing = cycles.find((c) => c.id === cycleId);
    if (existing?.loaded) return; // already loaded

    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select(
        `
        *,
        profiles ( full_name, phone ),
        location_axes ( name ),
        order_items (
          quantity, subtotal, with_inu_eran,
          product_variants (
            name,
            products ( name )
          )
        )
      `,
      )
      .eq("cycle_id", cycleId)
      .order("order_number", { ascending: true });

    setCycles((prev) =>
      prev.map((c) =>
        c.id === cycleId
          ? { ...c, orders: (data as CycleOrder[]) ?? [], loaded: true }
          : c,
      ),
    );
  }

  async function handleExpand(cycleId: string) {
    if (expandedId === cycleId) {
      setExpandedId(null);
    } else {
      setExpandedId(cycleId);
      await loadCycleOrders(cycleId);
    }
  }

  async function downloadPDF(cycle: CycleHistory) {
    if (!cycle.loaded) await loadCycleOrders(cycle.id);

    // Re-read from state after loading
    const fresh = cycles.find((c) => c.id === cycle.id);
    const orders = fresh?.orders ?? [];

    setDownloadingId(cycle.id);
    try {
      // Dynamically import jsPDF to keep bundle small
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageW = 210;
      const margin = 14;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── Header ──
      doc.setFillColor(28, 10, 6);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("EDIBLE MART", margin, 12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Cycle Sales Report", margin, 19);
      doc.text(
        `Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")}`,
        pageW - margin,
        19,
        { align: "right" },
      );
      y = 36;

      // ── Cycle info ──
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(cycle.title, margin, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Slaughter date: ${format(new Date(cycle.slaughter_date), "EEEE, MMMM do yyyy")}`,
        margin,
        y,
      );
      y += 5;
      doc.text(
        `Status: ${cycle.status.toUpperCase()}  ·  Total orders: ${orders.length}  ·  Limit: ${cycle.order_limit}`,
        margin,
        y,
      );
      y += 10;

      // ── Summary stats ──
      const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);
      const paidCount = orders.filter(
        (o) =>
          o.payment_status === "paid" || o.payment_status === "pod_settled",
      ).length;
      const unpaidCount = orders.filter(
        (o) => o.payment_status === "pod_pending",
      ).length;
      const deliveryCount = orders.filter(
        (o) => o.delivery_type === "delivery",
      ).length;
      const pickupCount = orders.filter(
        (o) => o.delivery_type === "pickup",
      ).length;

      // Stats row
      const statBoxW = contentW / 4;
      const statBoxH = 16;
      const statData = [
        { label: "Revenue", value: `N${totalRevenue.toLocaleString()}` },
        { label: "Paid", value: String(paidCount) },
        { label: "Unpaid", value: String(unpaidCount) },
        { label: "Delivery", value: String(deliveryCount) },
      ];
      statData.forEach((stat, i) => {
        const x = margin + i * statBoxW;
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, y, statBoxW - 2, statBoxH, 2, 2, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(232, 35, 26);
        doc.text(stat.value, x + (statBoxW - 2) / 2, y + 7, {
          align: "center",
        });
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text(stat.label, x + (statBoxW - 2) / 2, y + 13, {
          align: "center",
        });
      });
      y += statBoxH + 8;

      // ── Orders table ──
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Orders", margin, y);
      y += 5;

      // Table header
      const cols = {
        id: margin,
        name: margin + 16,
        items: margin + 52,
        type: margin + 115,
        payment: margin + 135,
        total: margin + 162,
      };
      doc.setFillColor(28, 10, 6);
      doc.rect(margin, y, contentW, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("#", cols.id, y + 4.5);
      doc.text("Recipient", cols.name, y + 4.5);
      doc.text("Items", cols.items, y + 4.5);
      doc.text("Type", cols.type, y + 4.5);
      doc.text("Payment", cols.payment, y + 4.5);
      doc.text("Total", cols.total, y + 4.5);
      y += 7;

      // Table rows
      orders.forEach((order, idx) => {
        // Check if we need a new page
        if (y > 265) {
          doc.addPage();
          y = margin;
        }

        const rowH = 8;
        doc.setFillColor(
          idx % 2 === 0 ? 250 : 255,
          idx % 2 === 0 ? 250 : 255,
          idx % 2 === 0 ? 250 : 255,
        );
        doc.rect(margin, y, contentW, rowH, "F");

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");

        const orderNum = `#EDM${String(order.order_number).padStart(3, "0")}`;
        doc.text(orderNum, cols.id, y + 5);
        doc.text(order.recipient_name.slice(0, 20), cols.name, y + 5);

        const itemsSummary = order.order_items
          .map(
            (i) =>
              `${i.product_variants.products.name}${i.with_inu_eran ? "+IE" : ""} x${i.quantity}`,
          )
          .join(", ")
          .slice(0, 38);
        doc.text(itemsSummary, cols.items, y + 5);

        doc.text(
          order.delivery_type === "delivery" ? "Delivery" : "Pickup",
          cols.type,
          y + 5,
        );

        const payLabel =
          order.payment_status === "paid"
            ? "Paid"
            : order.payment_status === "pod_settled"
              ? "Settled"
              : order.payment_status === "waived"
                ? "Waived"
                : "Unpaid";

        // Color payment status
        if (order.payment_status === "pod_pending") {
          doc.setTextColor(200, 50, 50);
        } else {
          doc.setTextColor(30, 130, 70);
        }
        doc.text(payLabel, cols.payment, y + 5);
        doc.setTextColor(0, 0, 0);

        doc.setFont("helvetica", "bold");
        doc.text(`N${order.total_amount.toLocaleString()}`, cols.total, y + 5);
        doc.setFont("helvetica", "normal");

        y += rowH;
      });

      // ── Footer total ──
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, margin + contentW, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Grand Total", margin, y);
      doc.setTextColor(232, 35, 26);
      doc.text(`N${totalRevenue.toLocaleString()}`, margin + contentW, y, {
        align: "right",
      });

      // ── Footer ──
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.setFont("helvetica", "normal");
        doc.text(`Edible Mart · ${cycle.title}`, margin, 292);
        doc.text(`Page ${i} of ${pageCount}`, pageW - margin, 292, {
          align: "right",
        });
      }

      doc.save(`Edible-Mart-${cycle.title.replace(/\s+/g, "-")}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err) {
      toast.error("Failed to generate PDF");
      console.error(err);
    }
    setDownloadingId(null);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Cycle History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All past and current booking cycles
        </p>
      </div>

      <div className="space-y-3">
        {cycles.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">
            No cycles yet
          </p>
        )}

        {cycles.map((cycle) => {
          const isExpanded = expandedId === cycle.id;
          const orders = cycle.orders ?? [];
          const isLoaded = cycle.loaded;
          const revenue = orders.reduce((s, o) => s + o.total_amount, 0);
          const unpaid = orders.filter(
            (o) => o.payment_status === "pod_pending",
          ).length;
          const isOpen = cycle.status === "open";

          return (
            <div
              key={cycle.id}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              {/* Header */}
              <button
                className="w-full text-left p-4 cursor-pointer"
                onClick={() => handleExpand(cycle.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {cycle.title}
                      </span>
                      <Badge
                        className={cn(
                          "text-[10px] px-2 py-0",
                          isOpen
                            ? "bg-green-600 hover:bg-green-600 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {isOpen ? "Active" : "Closed"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {format(
                          new Date(cycle.slaughter_date),
                          "EEE, MMM do yyyy",
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {cycle.current_orders} orders
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Stats */}
                  {isLoaded && (
                    <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatMini
                        icon={TrendingUp}
                        label="Revenue"
                        value={`₦${revenue.toLocaleString()}`}
                      />
                      <StatMini
                        icon={Users}
                        label="Orders"
                        value={String(orders.length)}
                      />
                      <StatMini
                        icon={Truck}
                        label="Delivery"
                        value={String(
                          orders.filter((o) => o.delivery_type === "delivery")
                            .length,
                        )}
                      />
                      <StatMini
                        icon={ShoppingBag}
                        label="Unpaid"
                        value={String(unpaid)}
                        danger={unpaid > 0}
                      />
                    </div>
                  )}

                  <Separator />

                  {/* Orders list */}
                  {isLoaded && orders.length > 0 && (
                    <div className="divide-y divide-border">
                      {orders.map((order) => (
                        <div
                          key={order.id}
                          className="px-4 py-3 flex items-start justify-between gap-2"
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono font-medium">
                                #EDM
                                {String(order.order_number).padStart(3, "0")}
                              </span>
                              <span className="text-xs font-medium truncate">
                                {order.recipient_name}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {order.profiles.full_name} ·{" "}
                              {order.profiles.phone}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                  order.payment_status === "pod_pending"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-green-100 text-green-800",
                                )}
                              >
                                {order.payment_status === "pod_pending"
                                  ? "Unpaid"
                                  : order.payment_status === "paid"
                                    ? "Paid"
                                    : order.payment_status === "pod_settled"
                                      ? "Settled"
                                      : "Waived"}
                              </span>
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {order.delivery_type}
                                {order.location_axes
                                  ? ` — ${order.location_axes.name}`
                                  : ""}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {order.order_items
                                .map(
                                  (i) =>
                                    `${i.product_variants.products.name}${i.with_inu_eran ? "+IE" : ""} ×${i.quantity}`,
                                )
                                .join(", ")}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-primary shrink-0">
                            ₦{order.total_amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isLoaded && orders.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No orders in this cycle
                    </div>
                  )}

                  <Separator />

                  {/* Download button */}
                  <div className="px-4 py-3">
                    <Button
                      variant="outline"
                      className="w-full cursor-pointer gap-2"
                      onClick={() => downloadPDF(cycle)}
                      disabled={downloadingId === cycle.id}
                    >
                      {downloadingId === cycle.id ? (
                        <>
                          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download cycle report (PDF)
                        </>
                      )}
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

function StatMini({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          danger ? "bg-red-50" : "bg-muted",
        )}
      >
        <Icon
          className={cn(
            "w-3.5 h-3.5",
            danger ? "text-red-600" : "text-muted-foreground",
          )}
        />
      </div>
      <div>
        <p className={cn("text-sm font-bold", danger && "text-red-600")}>
          {value}
        </p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
