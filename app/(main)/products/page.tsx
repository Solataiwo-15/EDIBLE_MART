"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/lib/store/cart";
import {
  Product,
  ProductVariant,
  CycleStock,
  BookingCycle,
  CartItem,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, ShoppingCart, Plus, Minus } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type ProductWithVariants = Product & {
  product_variants: ProductVariant[];
};

type StockMap = Record<string, number>; // variant_id -> remaining_slots

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [stockMap, setStockMap] = useState<StockMap>({});
  const [cycle, setCycle] = useState<BookingCycle | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<
    "all" | "cuts" | "special parts"
  >("all");
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get latest cycle
      const { data: cycleData } = await supabase
        .from("booking_cycles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setCycle(cycleData);

      // Get all available products with variants
      const { data: productData } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .eq("is_available", true)
        .order("sort_order");

      setProducts(productData ?? []);

      // Get stock for current cycle
      if (cycleData) {
        const { data: stockData } = await supabase
          .from("cycle_stock_remaining")
          .select("*")
          .eq("cycle_id", cycleData.id);

        const map: StockMap = {};
        stockData?.forEach((s) => {
          map[s.variant_id] = s.remaining_slots;
        });
        setStockMap(map);
      }

      setLoading(false);
    }
    load();
  }, []);

  const isOpen = cycle?.status === "open";

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const cuts = filtered.filter((p) => p.category === "cuts");
  const specials = filtered.filter((p) => p.category === "special parts");

  if (loading) return <ProductsSkeleton />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Closed banner */}
      {!isOpen && (
        <div className="rounded-xl bg-muted border border-border px-4 py-3 text-sm text-muted-foreground text-center">
          Bookings are currently closed — browsing only
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2">
        {(["all", "cuts", "special parts"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize cursor-pointer",
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50",
            )}
          >
            {cat === "all" ? "All" : cat === "cuts" ? "Cuts" : "Special Parts"}
          </button>
        ))}
      </div>

      {/* Cuts section */}
      {cuts.length > 0 && (
        <section className="space-y-3">
          {activeCategory === "all" && (
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Cuts
            </h2>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            {cuts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stockMap={stockMap}
                isOpen={isOpen}
                onAdd={addItem}
              />
            ))}
          </div>
        </section>
      )}

      {/* Special parts section */}
      {specials.length > 0 && (
        <section className="space-y-3">
          {activeCategory === "all" && (
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Special Parts
            </h2>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            {specials.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stockMap={stockMap}
                isOpen={isOpen}
                onAdd={addItem}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">
          No products found for `&quot;{search}&quot;`
        </p>
      )}
    </div>
  );
}

/* ── Product Card ── */
function ProductCard({
  product,
  stockMap,
  isOpen,
  onAdd,
}: {
  product: ProductWithVariants;
  stockMap: StockMap;
  isOpen: boolean;
  onAdd: (item: CartItem) => void;
}) {
  const variants = product.product_variants.filter((v) => v.is_available);
  const [selectedVariant, setSelectedVariant] = useState(variants[0] ?? null);
  const [withInuEran, setWithInuEran] = useState(false);
  const [qty, setQty] = useState(1);

  if (!selectedVariant) return null;

  // Always use the FULL SLOT variant as the stock source
  // Find the full/standard variant as the single stock pool source
  const fullSlotVariant =
    variants.find(
      (v) =>
        v.name.toLowerCase().includes("full slot") ||
        v.name.toLowerCase() === "full" ||
        v.name.toLowerCase() === "standard",
    ) ?? variants[0];

  const poolRemaining = stockMap[fullSlotVariant?.id] ?? null;
  const outOfStock = poolRemaining !== null && poolRemaining <= 0;

  // Half variants: "Half Slot" or just "Half"
  const isHalfSlot =
    selectedVariant.name.toLowerCase().includes("half slot") ||
    selectedVariant.name.toLowerCase() === "half";

  const displayRemaining =
    poolRemaining === null
      ? null
      : isHalfSlot
        ? Math.floor(poolRemaining * 2)
        : Math.floor(poolRemaining);

  const maxQty = displayRemaining === null ? 99 : Math.max(displayRemaining, 0);

  const canSplitInuEran =
    product.category === "cuts" &&
    !product.name.toLowerCase().includes("inu eran") &&
    !isHalfSlot;

  function handleAdd() {
    if (!isOpen) {
      toast.error("Bookings are closed right now");
      return;
    }
    if (outOfStock) {
      toast.error("This item is out of stock");
      return;
    }
    if (qty > maxQty) {
      toast.error(`Only ${maxQty} available`);
      return;
    }

    onAdd({
      variant_id: selectedVariant.id,
      product_name: product.name,
      variant_name: selectedVariant.name + (withInuEran ? " + Inu Eran" : ""),
      price: selectedVariant.price,
      quantity: qty,
      with_inu_eran: withInuEran,
    });
    toast.success(`${product.name} added to cart`);
    setQty(1);
    setWithInuEran(false);
  }

  function handleVariantChange(v: ProductVariant) {
    setSelectedVariant(v);
    setWithInuEran(false);
    setQty(1);
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card flex flex-col overflow-hidden transition-shadow hover:shadow-sm",
        outOfStock && "opacity-60",
      )}
    >
      {/* Product image */}
      <div className="relative w-full aspect-square bg-muted">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 300px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">🥩</span>
          </div>
        )}

        {/* Sold out overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Badge variant="secondary" className="text-xs">
              Sold out
            </Badge>
          </div>
        )}

        {/* Stock badge — green normally, orange when ≤ 5 */}
        {displayRemaining !== null && displayRemaining > 0 && (
          <Badge
            className={cn(
              "absolute top-2 right-2 text-[10px] font-semibold border-0",
              displayRemaining <= 5
                ? "bg-orange-500 hover:bg-orange-500 text-white"
                : "bg-green-600 hover:bg-green-600 text-white",
            )}
          >
            {displayRemaining} left
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div>
          <h3 className="font-semibold text-sm leading-tight">
            {product.name}
          </h3>
          <p className="text-primary font-bold text-sm mt-0.5">
            ₦
            {selectedVariant.price > 0
              ? selectedVariant.price.toLocaleString()
              : "Price TBD"}
          </p>
        </div>

        {/* Variant selector */}
        {variants.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {variants.map((v) => (
              <button
                key={v.id}
                onClick={() => handleVariantChange(v)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer",
                  selectedVariant.id === v.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border",
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        {/* Inu Eran toggle */}
        {canSplitInuEran && (
          <button
            onClick={() => setWithInuEran((w) => !w)}
            className={cn(
              "text-[11px] px-2 py-1 rounded-md border text-left transition-colors cursor-pointer w-full",
              withInuEran
                ? "bg-primary/10 text-primary border-primary/40 font-medium"
                : "bg-background text-muted-foreground border-border",
            )}
          >
            {withInuEran ? "✓ " : "+ "}Split with Inu Eran
          </button>
        )}

        {/* Quantity + Add to cart */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className={cn(
                "px-2 py-1.5 transition-colors",
                qty <= 1
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-muted cursor-pointer",
              )}
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-2 text-sm font-medium min-w-[24px] text-center">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              className={cn(
                "px-2 py-1.5 transition-colors",
                qty >= maxQty
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-muted cursor-pointer",
              )}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs cursor-pointer gap-1"
            onClick={handleAdd}
            disabled={outOfStock || !isOpen}
          >
            <ShoppingCart className="w-3 h-3" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Loading skeleton ── */
function ProductsSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
