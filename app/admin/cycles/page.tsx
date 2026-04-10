"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  CalendarDays,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Cycle = {
  id: string;
  title: string;
  status: "open" | "closed";
  slaughter_date: string;
  order_limit: number;
  current_orders: number;
  notes: string | null;
  created_at: string;
};

export default function AdminCyclesPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);

  const [newCycle, setNewCycle] = useState({
    title: "",
    slaughter_date: "",
    order_limit: "80",
    notes: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("booking_cycles")
        .select("*")
        .order("created_at", { ascending: false });
      setCycles((data as Cycle[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function createCycle() {
    if (!newCycle.title.trim()) {
      toast.error("Enter a cycle title");
      return;
    }
    if (!newCycle.slaughter_date) {
      toast.error("Select a slaughter date");
      return;
    }

    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("booking_cycles")
      .insert({
        title: newCycle.title.trim(),
        slaughter_date: newCycle.slaughter_date,
        order_limit: Number(newCycle.order_limit),
        notes: newCycle.notes.trim() || null,
        status: "closed",
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create cycle");
    } else {
      toast.success("Cycle created — now set stock then open bookings");
      setCycles((prev) => [data as Cycle, ...prev]);
      setNewCycle({
        title: "",
        slaughter_date: "",
        order_limit: "80",
        notes: "",
      });
      setShowNewForm(false);
    }
    setCreating(false);
  }

  async function toggleCycleStatus(cycle: Cycle) {
    setToggling(cycle.id);
    const supabase = createClient();
    const newStatus = cycle.status === "open" ? "closed" : "open";

    const { error } = await supabase
      .from("booking_cycles")
      .update({ status: newStatus })
      .eq("id", cycle.id);

    if (error) {
      toast.error("Failed to update cycle status");
    } else {
      toast.success(
        newStatus === "open" ? "Bookings opened!" : "Bookings closed",
      );
      setCycles((prev) =>
        prev.map((c) => (c.id === cycle.id ? { ...c, status: newStatus } : c)),
      );
    }
    setToggling(null);
  }

  async function updateCycleLimit(cycleId: string, limit: number) {
    const supabase = createClient();
    const { error } = await supabase
      .from("booking_cycles")
      .update({ order_limit: limit })
      .eq("id", cycleId);
    if (error) toast.error("Failed to update limit");
    else {
      toast.success("Limit updated");
      setCycles((prev) =>
        prev.map((c) => (c.id === cycleId ? { ...c, order_limit: limit } : c)),
      );
    }
  }

  async function sendEmailBlast(
    cycleId: string,
    cycleTitle: string,
    slaughterDate: string,
  ) {
    setEmailing(true);
    const { sendBookingOpenBlast } = await import("@/lib/email");
    const result = await sendBookingOpenBlast(
      cycleTitle,
      format(new Date(slaughterDate), "EEEE, MMMM do"),
    );
    toast.success(`Email blast sent to ${result.sent} customers!`);
    setEmailing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCycle = cycles.find((c) => c.status === "open");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Booking Cycles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCycle
              ? `Active: ${activeCycle.title}`
              : "No active cycle — create one to open bookings"}
          </p>
        </div>
        <Button
          size="sm"
          className="cursor-pointer gap-2"
          onClick={() => setShowNewForm((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" />
          New cycle
        </Button>
      </div>

      {/* ── New cycle form ── */}
      {showNewForm && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <h2 className="font-semibold text-sm">Create new cycle</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs">
                Cycle title
              </Label>
              <Input
                id="title"
                placeholder="e.g. May 3rd Booking"
                value={newCycle.title}
                onChange={(e) =>
                  setNewCycle((p) => ({ ...p, title: e.target.value }))
                }
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs">
                Slaughter date
              </Label>
              <Input
                id="date"
                type="date"
                value={newCycle.slaughter_date}
                onChange={(e) =>
                  setNewCycle((p) => ({ ...p, slaughter_date: e.target.value }))
                }
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="limit" className="text-xs">
                Order limit
              </Label>
              <Input
                id="limit"
                type="number"
                min={1}
                value={newCycle.order_limit}
                onChange={(e) =>
                  setNewCycle((p) => ({ ...p, order_limit: e.target.value }))
                }
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs">
                Internal notes (optional)
              </Label>
              <Input
                id="notes"
                placeholder="e.g. Big cow this week"
                value={newCycle.notes}
                onChange={(e) =>
                  setNewCycle((p) => ({ ...p, notes: e.target.value }))
                }
                className="h-10"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
            💡 After creating, go to <strong>Products</strong> to set stock for
            each variant before opening bookings.
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setShowNewForm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={createCycle}
              disabled={creating}
            >
              {creating && (
                <Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" />
              )}
              Create cycle
            </Button>
          </div>
        </div>
      )}

      {/* ── Cycles list ── */}
      <div className="space-y-3">
        {cycles.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">
            No cycles yet — create your first one above
          </p>
        )}

        {cycles.map((cycle) => {
          const isOpen = cycle.status === "open";
          const isExpanded = expandedId === cycle.id;
          const isToggling = toggling === cycle.id;
          const progress =
            cycle.order_limit > 0
              ? Math.min((cycle.current_orders / cycle.order_limit) * 100, 100)
              : 0;
          const slotsLeft = cycle.order_limit - cycle.current_orders;

          return (
            <div
              key={cycle.id}
              className={cn(
                "rounded-2xl border bg-card overflow-hidden",
                isOpen && "border-primary/40",
              )}
            >
              {/* Card header */}
              <button
                className="w-full text-left p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : cycle.id)}
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
                        {isOpen ? "Open" : "Closed"}
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
                        {cycle.current_orders} / {cycle.order_limit} booked
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          progress >= 90
                            ? "bg-red-500"
                            : progress >= 70
                              ? "bg-orange-500"
                              : "bg-primary",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  )}
                </div>
              </button>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {/* Stats */}
                  <div className="px-4 py-3 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-lg font-bold">
                        {cycle.current_orders}
                      </p>
                      <p className="text-xs text-muted-foreground">Orders</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">
                        {Math.max(slotsLeft, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Slots left
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">
                        {Math.round(progress)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Full</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Update limit */}
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Order limit
                    </p>
                    <LimitField
                      initialValue={cycle.order_limit}
                      onSave={(val) => updateCycleLimit(cycle.id, val)}
                    />
                  </div>

                  <Separator />

                  {/* Notes */}
                  {cycle.notes && (
                    <>
                      <div className="px-4 py-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Notes
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {cycle.notes}
                        </p>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Actions */}
                  <div className="px-4 py-3 space-y-2">
                    {/* Open / Close toggle */}
                    <Button
                      className={cn(
                        "w-full cursor-pointer",
                        isOpen ? "bg-red-600 hover:bg-red-700" : "",
                      )}
                      onClick={() => toggleCycleStatus(cycle)}
                      disabled={isToggling}
                    >
                      {isToggling && (
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      )}
                      {isOpen ? "Close bookings" : "Open bookings"}
                    </Button>

                    {/* Email blast — only when opening or already open */}
                    {isOpen && (
                      <Button
                        variant="outline"
                        className="w-full cursor-pointer gap-2"
                        onClick={() =>
                          sendEmailBlast(
                            cycle.id,
                            cycle.title,
                            cycle.slaughter_date,
                          )
                        }
                        disabled={emailing}
                      >
                        {emailing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                        Send email blast to customers
                      </Button>
                    )}
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

/* ── Editable limit field ── */
function LimitField({
  initialValue,
  onSave,
}: {
  initialValue: number;
  onSave: (val: number) => void;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex gap-2">
      <Input
        type="number"
        value={value}
        min={1}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        className="h-9 text-sm"
      />
      {dirty && (
        <Button
          size="sm"
          className="h-9 cursor-pointer shrink-0"
          onClick={() => {
            onSave(Number(value));
            setDirty(false);
          }}
        >
          Save
        </Button>
      )}
    </div>
  );
}
