"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
};

type Product = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  product_variants: Variant[];
};

type CycleStock = {
  variant_id: string;
  stock_slots: number;
  sold_slots: number;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, CycleStock>>({});
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [cycleTitle, setCycleTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get latest cycle
      const { data: cycle } = await supabase
        .from("booking_cycles")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setCycleId(cycle?.id ?? null);
      setCycleTitle(cycle?.title ?? "");

      // Get all products with variants
      const { data: productData } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .order("sort_order");

      setProducts(productData ?? []);

      // Get cycle stock
      if (cycle) {
        const { data: stockData } = await supabase
          .from("cycle_stock")
          .select("*")
          .eq("cycle_id", cycle.id);

        const map: Record<string, CycleStock> = {};
        stockData?.forEach((s) => {
          map[s.variant_id] = s;
        });
        setStockMap(map);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function updateVariantPrice(variantId: string, price: number) {
    const supabase = createClient();
    const { error } = await supabase
      .from("product_variants")
      .update({ price })
      .eq("id", variantId);
    if (error) toast.error("Failed to update price");
    else {
      toast.success("Price updated");
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          product_variants: p.product_variants.map((v) =>
            v.id === variantId ? { ...v, price } : v,
          ),
        })),
      );
    }
  }

  async function toggleVariantAvailability(
    variantId: string,
    current: boolean,
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("product_variants")
      .update({ is_available: !current })
      .eq("id", variantId);
    if (error) toast.error("Failed to update availability");
    else {
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          product_variants: p.product_variants.map((v) =>
            v.id === variantId ? { ...v, is_available: !current } : v,
          ),
        })),
      );
    }
  }

  async function toggleProductAvailability(
    productId: string,
    current: boolean,
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_available: !current })
      .eq("id", productId);
    if (error) toast.error("Failed to update product");
    else {
      toast.success(!current ? "Product visible" : "Product hidden");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, is_available: !current } : p,
        ),
      );
    }
  }

  async function updateCycleStock(variantId: string, stockSlots: number) {
    if (!cycleId) {
      toast.error("No active cycle");
      return;
    }
    const supabase = createClient();

    // Upsert — creates if doesn't exist, updates if it does
    const { error } = await supabase.from("cycle_stock").upsert(
      {
        cycle_id: cycleId,
        variant_id: variantId,
        stock_slots: stockSlots,
      },
      { onConflict: "cycle_id,variant_id" },
    );

    if (error) toast.error("Failed to update stock");
    else {
      toast.success("Stock updated");
      setStockMap((prev) => ({
        ...prev,
        [variantId]: {
          ...prev[variantId],
          variant_id: variantId,
          stock_slots: stockSlots,
          sold_slots: prev[variantId]?.sold_slots ?? 0,
        },
      }));
    }
  }

  async function uploadImage(productId: string, file: File) {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${productId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Upload failed");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("products")
      .getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: urlData.publicUrl })
      .eq("id", productId);

    if (updateError) toast.error("Failed to save image URL");
    else {
      toast.success("Image uploaded!");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, image_url: urlData.publicUrl } : p,
        ),
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cuts = products.filter((p) => p.category === "cuts");
  const specials = products.filter((p) => p.category === "special parts");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold">Products & Pricing</h1>
        {cycleTitle && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Setting stock for:{" "}
            <span className="font-medium text-foreground">{cycleTitle}</span>
          </p>
        )}
      </div>

      {/* ── Cuts ── */}
      <ProductSection
        title="Cuts"
        products={cuts}
        stockMap={stockMap}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        onUpdatePrice={updateVariantPrice}
        onToggleVariant={toggleVariantAvailability}
        onToggleProduct={toggleProductAvailability}
        onUpdateStock={updateCycleStock}
        onUploadImage={uploadImage}
      />

      {/* ── Special parts ── */}
      <ProductSection
        title="Special Parts"
        products={specials}
        stockMap={stockMap}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        onUpdatePrice={updateVariantPrice}
        onToggleVariant={toggleVariantAvailability}
        onToggleProduct={toggleProductAvailability}
        onUpdateStock={updateCycleStock}
        onUploadImage={uploadImage}
      />
    </div>
  );
}

/* ── Product section ── */
function ProductSection({
  title,
  products,
  stockMap,
  expandedId,
  setExpandedId,
  onUpdatePrice,
  onToggleVariant,
  onToggleProduct,
  onUpdateStock,
  onUploadImage,
}: {
  title: string;
  products: Product[];
  stockMap: Record<string, CycleStock>;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onUpdatePrice: (variantId: string, price: number) => void;
  onToggleVariant: (variantId: string, current: boolean) => void;
  onToggleProduct: (productId: string, current: boolean) => void;
  onUpdateStock: (variantId: string, stock: number) => void;
  onUploadImage: (productId: string, file: File) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          stockMap={stockMap}
          isExpanded={expandedId === product.id}
          onToggle={() =>
            setExpandedId(expandedId === product.id ? null : product.id)
          }
          onUpdatePrice={onUpdatePrice}
          onToggleVariant={onToggleVariant}
          onToggleProduct={onToggleProduct}
          onUpdateStock={onUpdateStock}
          onUploadImage={onUploadImage}
        />
      ))}
    </div>
  );
}

/* ── Product card ── */
function ProductCard({
  product,
  stockMap,
  isExpanded,
  onToggle,
  onUpdatePrice,
  onToggleVariant,
  onToggleProduct,
  onUpdateStock,
  onUploadImage,
}: {
  product: Product;
  stockMap: Record<string, CycleStock>;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdatePrice: (variantId: string, price: number) => void;
  onToggleVariant: (variantId: string, current: boolean) => void;
  onToggleProduct: (productId: string, current: boolean) => void;
  onUpdateStock: (variantId: string, stock: number) => void;
  onUploadImage: (productId: string, file: File) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden",
        !product.is_available && "opacity-60",
      )}
    >
      {/* Header */}
      <button
        className="w-full text-left p-4 cursor-pointer flex items-center gap-3"
        onClick={onToggle}
      >
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={48}
              height={48}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-xl">🥩</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {product.product_variants.length} variant
            {product.product_variants.length !== 1 ? "s" : ""} ·{" "}
            {product.is_available ? "Visible" : "Hidden"}
          </p>
        </div>

        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border divide-y divide-border">
          {/* Image upload */}
          <div className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Product image
            </Label>
            <div className="flex items-center gap-3">
              {product.image_url && (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-border shrink-0">
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 cursor-pointer transition-colors">
                <ImagePlus className="w-4 h-4" />
                {product.image_url ? "Change image" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadImage(product.id, file);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Variants */}
          <div className="p-4 space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Variants & pricing
            </Label>
            {product.product_variants.map((variant) => {
              const stock = stockMap[variant.id];
              const soldSlots = stock?.sold_slots ?? 0;
              const isHalf = variant.name.toLowerCase().includes("half slot");

              return (
                <div
                  key={variant.id}
                  className={cn(
                    "rounded-xl border border-border p-3 space-y-3",
                    !variant.is_available && "opacity-50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{variant.name}</p>
                    <button
                      onClick={() =>
                        onToggleVariant(variant.id, variant.is_available)
                      }
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border cursor-pointer transition-colors",
                        variant.is_available
                          ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                          : "border-border text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {variant.is_available ? (
                        <>
                          <Eye className="w-3 h-3" /> Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" /> Hidden
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Price */}
                    <PriceField
                      label="Price (₦)"
                      initialValue={variant.price}
                      onSave={(val) => onUpdatePrice(variant.id, val)}
                    />

                    {/* Stock */}
                    {/* Only show stock field for full/standard variants — half slot is derived */}
                    {!variant.name.toLowerCase().includes("half slot") && (
                      <StockField
                        label="Stock (full slots)"
                        initialValue={stock?.stock_slots ?? 0}
                        soldSlots={soldSlots}
                        onSave={(val) => onUpdateStock(variant.id, val)}
                      />
                    )}
                    {variant.name.toLowerCase().includes("half slot") && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Stock</p>
                        <div className="h-8 flex items-center">
                          <p className="text-xs text-muted-foreground italic leading-tight">
                            Derived from Full Slot pool
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {soldSlots > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {soldSlots} slot{soldSlots !== 1 ? "s" : ""} sold so far
                      this cycle
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Visibility toggle */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Product visibility</p>
              <p className="text-xs text-muted-foreground">
                {product.is_available
                  ? "Shown to customers"
                  : "Hidden from customers"}
              </p>
            </div>
            <button
              onClick={() => onToggleProduct(product.id, product.is_available)}
              className={cn(
                "flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border cursor-pointer transition-colors",
                product.is_available
                  ? "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                  : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100",
              )}
            >
              {product.is_available ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" /> Hide product
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" /> Show product
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Editable price field ── */
function PriceField({
  label,
  initialValue,
  onSave,
}: {
  label: string;
  initialValue: number;
  onSave: (val: number) => void;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [dirty, setDirty] = useState(false);

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
          }}
          className="h-8 text-xs"
          min={0}
        />
        {dirty && (
          <Button
            size="sm"
            className="h-8 text-xs px-2 cursor-pointer shrink-0"
            onClick={() => {
              onSave(Number(value));
              setDirty(false);
            }}
          >
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Editable stock field ── */
function StockField({
  label,
  initialValue,
  soldSlots,
  onSave,
}: {
  label: string;
  initialValue: number;
  soldSlots: number;
  onSave: (val: number) => void;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [dirty, setDirty] = useState(false);

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
          }}
          className="h-8 text-xs"
          min={soldSlots} // can't set stock below what's already sold
        />
        {dirty && (
          <Button
            size="sm"
            className="h-8 text-xs px-2 cursor-pointer shrink-0"
            onClick={() => {
              onSave(Number(value));
              setDirty(false);
            }}
          >
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
