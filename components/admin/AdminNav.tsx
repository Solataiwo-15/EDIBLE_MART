"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingBasket,
  RefreshCw,
  MapPin,
  Users,
  LogOut,
  Menu,
  X,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/products", label: "Products", icon: ShoppingBasket },
  { href: "/admin/cycles", label: "Cycles", icon: RefreshCw },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/history", label: "History", icon: History },
];

export default function AdminNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-brand-dark text-white flex items-center px-4 gap-4">
        <button
          className="md:hidden p-1 cursor-pointer"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        <Link href="/admin" className="flex items-center">
          <Image
            src="/logo.jpeg"
            alt="Edible Mart"
            width={40}
            height={10}
            className="object-contain invert"
            priority
          />
        </Link>

        <span className="ml-2 text-xs text-white/50 hidden md:block">
          Admin
        </span>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-white/70 hidden sm:block">
            {userName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 cursor-pointer gap-1.5"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sign out</span>
          </Button>
        </div>
      </header>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-56 bg-background border-r border-border flex-col py-4 z-40">
        <nav className="flex-1 px-3 space-y-0.5">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Back to store */}
        <div className="px-3 pt-3 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            ← Back to store
          </Link>
        </div>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-16">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <nav className="relative bg-background w-64 h-full border-r border-border py-4 px-3 space-y-0.5 overflow-y-auto">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
            <div className="pt-3 border-t border-border">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                ← Back to store
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
