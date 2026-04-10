import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ShoppingBasket,
  Users,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface RecentOrder {
  id: string;
  order_number: number;
  recipient_name: string;
  total_amount: number;
  payment_status: string;
  status: string;
  delivery_type: string;
  created_at: string;
  //   booking_cycles: { title: string }[] | null | any;
  // You can add status and created_at if you want to be fully accurate
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Get latest cycle
  const { data: cycle } = await supabase
    .from("booking_cycles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Stats for current cycle
  const { data: cycleOrders } = await supabase
    .from("orders")
    .select("id, total_amount, payment_status, status, delivery_type")
    .eq("cycle_id", cycle?.id ?? "");

  const totalOrders = cycleOrders?.length ?? 0;
  const totalRevenue =
    cycleOrders?.reduce((sum, o) => sum + o.total_amount, 0) ?? 0;
  const unpaidCount =
    cycleOrders?.filter((o) => o.payment_status === "pod_pending").length ?? 0;
  const deliveryCount =
    cycleOrders?.filter((o) => o.delivery_type === "delivery").length ?? 0;
  const pickupCount =
    cycleOrders?.filter((o) => o.delivery_type === "pickup").length ?? 0;
  const slotsLeft = cycle ? cycle.order_limit - cycle.current_orders : 0;

  // Total customers
  const { count: totalCustomers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_admin", false);

  // Recent 5 orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select(
      `
      id, order_number, recipient_name, total_amount,
      payment_status, status, delivery_type, created_at,
      booking_cycles ( title )
    `,
    )
    .eq("cycle_id", cycle?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(5);

  const isOpen = cycle?.status === "open";

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {cycle ? cycle.title : "No active cycle"}
          </p>
        </div>
        <Link href="/admin/cycles">
          <Button size="sm" className="cursor-pointer gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            {isOpen ? "Manage cycle" : "Open new cycle"}
          </Button>
        </Link>
      </div>

      {/* ── Cycle status banner ── */}
      {cycle && (
        <div
          className={`rounded-2xl p-4 border flex items-center justify-between gap-4 flex-wrap ${
            isOpen ? "bg-green-50 border-green-200" : "bg-muted border-border"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${isOpen ? "bg-green-500" : "bg-gray-400"}`}
            />
            <div>
              <p className="font-semibold text-sm">
                Bookings are {isOpen ? "open" : "closed"}
              </p>
              <p className="text-xs text-muted-foreground">
                {cycle.current_orders} / {cycle.order_limit} slots booked
                {isOpen && slotsLeft <= 10 && (
                  <span className="text-orange-600 ml-1">
                    · Only {slotsLeft} left!
                  </span>
                )}
              </p>
            </div>
          </div>
          <Link href="/admin/cycles">
            <Button
              size="sm"
              variant={isOpen ? "destructive" : "default"}
              className="cursor-pointer text-xs"
            >
              {isOpen ? "Close bookings" : "Open bookings"}
            </Button>
          </Link>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total orders"
          value={totalOrders}
          icon={ShoppingBasket}
          color="blue"
        />
        <StatCard
          label="Revenue"
          value={`₦${totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Unpaid"
          value={unpaidCount}
          icon={AlertCircle}
          color={unpaidCount > 0 ? "orange" : "green"}
        />
        <StatCard
          label="Customers"
          value={totalCustomers ?? 0}
          icon={Users}
          color="purple"
        />
      </div>

      {/* ── Delivery breakdown ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Delivery orders</p>
          <p className="text-2xl font-bold">{deliveryCount}</p>
          <p className="text-xs text-muted-foreground">Need to be dispatched</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Pickup orders</p>
          <p className="text-2xl font-bold">{pickupCount}</p>
          <p className="text-xs text-muted-foreground">Coming to collect</p>
        </div>
      </div>

      {/* ── Recent orders ── */}
      {recentOrders && recentOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentOrders.map((order: RecentOrder) => (
              <Link
                key={order.id}
                href={`/admin/orders?highlight=${order.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">
                    {order.recipient_name}
                    <span className="text-xs text-muted-foreground ml-2">
                      EDM{String(order.order_number).padStart(3, "0")}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        order.payment_status === "paid" ||
                        order.payment_status === "pod_settled"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {order.payment_status === "pod_pending"
                        ? "Unpaid"
                        : "Paid"}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {order.delivery_type}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">
                    ₦{order.total_amount.toLocaleString()}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            {
              href: "/admin/orders",
              label: "Manage orders",
              desc: "Filter & update",
            },
            {
              href: "/admin/products",
              label: "Edit products",
              desc: "Prices & images",
            },
            {
              href: "/admin/cycles",
              label: "Cycle manager",
              desc: "Open / close",
            },
            {
              href: "/admin/customers",
              label: "Customers",
              desc: "Debt & history",
            },
            {
              href: "/admin/locations",
              label: "Delivery areas",
              desc: "Fees & zones",
            },
          ].map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="rounded-xl border border-border bg-card p-3 hover:border-primary/40 transition-colors cursor-pointer h-full">
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {link.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: "blue" | "green" | "orange" | "purple";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
