import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  ShoppingBasket,
  ChevronRight,
  PackageCheck,
} from "lucide-react";
import { BookingCycle } from "@/lib/types";
import { format } from "date-fns";

async function getActiveCycle(): Promise<BookingCycle | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_cycles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}

export default async function HomePage() {
  const cycle = await getActiveCycle();
  const isOpen = cycle?.status === "open";
  const slotsLeft = cycle ? cycle.order_limit - cycle.current_orders : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ── Booking status banner ── */}
      <div
        className={`rounded-2xl p-5 border ${
          isOpen ? "bg-green-50 border-green-200" : "bg-muted border-border"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <Badge
            className={
              isOpen
                ? "bg-green-600 hover:bg-green-600 text-white text-xs"
                : "bg-muted-foreground/20 text-muted-foreground text-xs"
            }
          >
            {isOpen ? "Bookings Open" : "Bookings Closed"}
          </Badge>
          {isOpen && slotsLeft <= 10 && slotsLeft > 0 && (
            <span className="text-xs font-medium text-orange-600">
              Only {slotsLeft} slots left!
            </span>
          )}
        </div>

        {cycle ? (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">{cycle.title}</h2>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span>
                  Slaughter day:{" "}
                  <span className="font-medium text-foreground">
                    {format(new Date(cycle.slaughter_date), "EEEE, MMMM do")}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PackageCheck className="w-4 h-4 shrink-0" />
                <span>
                  {cycle.current_orders} of {cycle.order_limit} slots booked
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No active booking cycle right now. Check back soon!
          </p>
        )}

        {isOpen && (
          <Link href="/products" className="block mt-4">
            <Button className="w-full cursor-pointer h-11 gap-2">
              <ShoppingBasket className="w-4 h-4" />
              Browse & Book Now
            </Button>
          </Link>
        )}

        {!isOpen && (
          <p className="text-sm text-muted-foreground mt-3">
            Bookings are currently closed. We&apos;ll email you when the next
            cycle opens.
          </p>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Quick links
        </h3>

        <Link href="/products">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors cursor-pointer mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingBasket className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Our products</p>
                <p className="text-xs text-muted-foreground">
                  Beef, Agemawo, Ike, Ige & more
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>

        <Link href="/orders">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">My orders</p>
                <p className="text-xs text-muted-foreground">
                  View history & rebook past orders
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* ── How it works ── */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          How it works
        </h3>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {[
            { step: "1", text: "Browse products and add your items to cart" },
            { step: "2", text: "Checkout — choose delivery or pickup" },
            { step: "3", text: "Pay upfront or on delivery" },
            { step: "4", text: "Pick up or receive delivery every Saturday" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-4 px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                {step}
              </span>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
