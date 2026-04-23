"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type CustomerOrder = {
  id: string;
  order_number: number;
  total_amount: number;
  payment_status: string;
  status: string;
  delivery_type: string;
  created_at: string;
  booking_cycles: { title: string };
};

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  default_location_id: string | null;
  location_axes: { name: string } | null;
  orders: CustomerOrder[];
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "debt">("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select(
          `
          *,
          location_axes ( name ),
          orders (
            id, order_number, total_amount, payment_status,
            status, delivery_type, created_at,
            booking_cycles ( title )
          )
        `,
        )
        .eq("is_admin", false)
        .order("created_at", { ascending: false });

      setCustomers((data as Customer[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter((c) => {
    const matchesSearch =
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search);
    const hasDebt = c.orders.some((o) => o.payment_status === "pod_pending");
    const matchesFilter = filter === "all" ? true : hasDebt;
    return matchesSearch && matchesFilter;
  });

  const debtCount = customers.filter((c) =>
    c.orders.some((o) => o.payment_status === "pod_pending"),
  ).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {customers.length} registered · {debtCount} with debt
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all" as const, label: `All (${customers.length})` },
          { value: "debt" as const, label: `With debt (${debtCount})` },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer",
              filter === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Customer list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">
            No customers found
          </p>
        )}
        {filtered.map((customer) => {
          const hasDebt = customer.orders.some(
            (o) => o.payment_status === "pod_pending",
          );
          const totalSpent = customer.orders
            .filter((o) => o.status !== "cancelled")
            .reduce((sum, o) => sum + o.total_amount, 0);
          const isExpanded = expandedId === customer.id;

          return (
            <div
              key={customer.id}
              className={cn(
                "rounded-2xl border bg-card overflow-hidden",
                hasDebt && "border-orange-200",
              )}
            >
              <button
                className="w-full text-left p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : customer.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {customer.full_name}
                      </span>
                      {hasDebt && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Has debt
                        </span>
                      )}
                      {!hasDebt && customer.orders.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Clear
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.location_axes && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {customer.location_axes.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {customer.orders.length} order
                      {customer.orders.length !== 1 ? "s" : ""} · Joined{" "}
                      {format(new Date(customer.created_at), "MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-sm font-bold text-primary">
                      ₦{totalSpent.toLocaleString()}
                    </p>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded order history */}
              {isExpanded && customer.orders.length > 0 && (
                <div className="border-t border-border">
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Order history
                    </p>
                    {customer.orders
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime(),
                      )
                      .map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between py-1.5"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium">
                                EDM{String(order.order_number).padStart(3, "0")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {order.booking_cycles.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
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
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-medium shrink-0 ml-2">
                            ₦{order.total_amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                  <Separator />
                  <div className="px-4 py-3 flex justify-between text-sm font-bold">
                    <span>Total spent</span>
                    <span className="text-primary">
                      ₦{totalSpent.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {isExpanded && customer.orders.length === 0 && (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">No orders yet</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
