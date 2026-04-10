"use client";

import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, ShoppingBasket, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center gap-5 text-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <ShoppingBasket className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Add some products to get started
          </p>
        </div>
        <Link href="/products">
          <Button className="cursor-pointer gap-2 px-6">
            <ShoppingBasket className="w-4 h-4" />
            Browse products
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-xl font-bold">Your cart</h1>

      {/* ── Cart items ── */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.variant_id}-${item.with_inu_eran}`}
            className="flex gap-4 p-4 rounded-2xl border border-border bg-card"
          >
            {/* Image / emoji */}
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0 text-2xl">
              🥩
            </div>

            {/* Name + variant + price */}
            <div className="flex-1 min-w-0 py-0.5">
              <p className="font-semibold text-sm leading-snug">
                {item.product_name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.variant_name}
              </p>
              <p className="text-primary font-bold text-sm mt-2">
                ₦{(item.price * item.quantity).toLocaleString()}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-end justify-between shrink-0">
              <button
                onClick={() => removeItem(item.variant_id, item.with_inu_eran)}
                className="text-muted-foreground hover:text-red-500 transition-colors cursor-pointer p-1 -mr-1"
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="flex items-center rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() =>
                    updateQuantity(
                      item.variant_id,
                      item.with_inu_eran,
                      item.quantity - 1,
                    )
                  }
                  className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <button
                  onClick={() =>
                    updateQuantity(
                      item.variant_id,
                      item.with_inu_eran,
                      item.quantity + 1,
                    )
                  }
                  className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Order summary ── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Order summary</h2>
        <Separator />
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.variant_id}-${item.with_inu_eran}-summary`}
              className="flex justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {item.product_name}
                {item.with_inu_eran ? " + Inu Eran" : ""} × {item.quantity}
              </span>
              <span className="font-medium">
                ₦{(item.price * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <span className="font-bold text-base">Subtotal</span>
          <span className="font-bold text-base text-primary">
            ₦{total().toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Delivery fee is calculated at checkout based on your chosen location
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="space-y-3 pb-4">
        <Link href="/checkout">
          <Button className="w-full h-13 cursor-pointer gap-2 text-[15px] rounded-2xl py-4">
            Proceed to checkout
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
        <Link href="/products">
          <Button
            variant="outline"
            className="w-full h-12 cursor-pointer rounded-2xl mt-2"
          >
            Continue shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
