"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Loader2, Eye, EyeOff, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Location = {
  id: string;
  name: string;
  delivery_fee: number;
  is_active: boolean;
};

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newLocation, setNewLocation] = useState({
    name: "",
    delivery_fee: "",
  });
  const [editValues, setEditValues] = useState<{
    name: string;
    delivery_fee: string;
  }>({
    name: "",
    delivery_fee: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("location_axes")
        .select("*")
        .order("name");
      setLocations((data as Location[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function createLocation() {
    if (!newLocation.name.trim()) {
      toast.error("Enter a location name");
      return;
    }
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("location_axes")
      .insert({
        name: newLocation.name.trim(),
        delivery_fee: Number(newLocation.delivery_fee) || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) toast.error("Failed to create location");
    else {
      toast.success("Location added");
      setLocations((prev) =>
        [...prev, data as Location].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setNewLocation({ name: "", delivery_fee: "" });
      setShowNewForm(false);
    }
    setCreating(false);
  }

  async function saveEdit(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("location_axes")
      .update({
        name: editValues.name.trim(),
        delivery_fee: Number(editValues.delivery_fee) || 0,
      })
      .eq("id", id);

    if (error) toast.error("Failed to update");
    else {
      toast.success("Location updated");
      setLocations((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                name: editValues.name.trim(),
                delivery_fee: Number(editValues.delivery_fee) || 0,
              }
            : l,
        ),
      );
      setEditingId(null);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("location_axes")
      .update({ is_active: !current })
      .eq("id", id);

    if (error) toast.error("Failed to update");
    else {
      setLocations((prev) =>
        prev.map((l) => (l.id === id ? { ...l, is_active: !current } : l)),
      );
      toast.success(!current ? "Location activated" : "Location deactivated");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Delivery Areas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {locations.filter((l) => l.is_active).length} active areas
          </p>
        </div>
        <Button
          size="sm"
          className="cursor-pointer gap-2"
          onClick={() => setShowNewForm((v) => !v)}
        >
          <Plus className="w-3.5 h-3.5" />
          Add area
        </Button>
      </div>

      {/* New location form */}
      {showNewForm && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <h2 className="font-semibold text-sm">Add delivery area</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Area name</Label>
              <Input
                placeholder="e.g. Ibadan — Bodija axis"
                value={newLocation.name}
                onChange={(e) =>
                  setNewLocation((p) => ({ ...p, name: e.target.value }))
                }
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Delivery fee (₦)</Label>
              <Input
                type="number"
                placeholder="e.g. 500"
                value={newLocation.delivery_fee}
                onChange={(e) =>
                  setNewLocation((p) => ({
                    ...p,
                    delivery_fee: e.target.value,
                  }))
                }
                className="h-10"
                min={0}
              />
            </div>
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
              onClick={createLocation}
              disabled={creating}
            >
              {creating && (
                <Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" />
              )}
              Add area
            </Button>
          </div>
        </div>
      )}

      {/* Locations list */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {locations.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">
            No delivery areas yet
          </p>
        )}
        {locations.map((loc) => {
          const isEditing = editingId === loc.id;
          return (
            <div
              key={loc.id}
              className={cn("px-4 py-3", !loc.is_active && "opacity-50")}
            >
              {isEditing ? (
                /* Edit mode */
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={editValues.name}
                    onChange={(e) =>
                      setEditValues((p) => ({ ...p, name: e.target.value }))
                    }
                    className="h-8 text-sm flex-1 min-w-32"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">₦</span>
                    <Input
                      type="number"
                      value={editValues.delivery_fee}
                      onChange={(e) =>
                        setEditValues((p) => ({
                          ...p,
                          delivery_fee: e.target.value,
                        }))
                      }
                      className="h-8 text-sm w-24"
                      min={0}
                    />
                  </div>
                  <button
                    onClick={() => saveEdit(loc.id)}
                    className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center hover:bg-green-200 cursor-pointer transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 cursor-pointer transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {loc.delivery_fee > 0
                        ? `₦${loc.delivery_fee.toLocaleString()} delivery fee`
                        : "Free / Pickup"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(loc.id);
                        setEditValues({
                          name: loc.name,
                          delivery_fee: String(loc.delivery_fee),
                        });
                      }}
                      className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => toggleActive(loc.id, loc.is_active)}
                      className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors",
                        loc.is_active
                          ? "border-border hover:bg-muted"
                          : "border-green-200 bg-green-50 hover:bg-green-100",
                      )}
                    >
                      {loc.is_active ? (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-green-700" />
                      )}
                    </button>
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
