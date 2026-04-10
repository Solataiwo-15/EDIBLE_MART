"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { useCartStore } from "@/lib/store/cart";
import {
  Home,
  ShoppingBasket,
  ClipboardList,
  ShoppingCart,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/products", label: "Products", icon: ShoppingBasket },
  { href: "/orders", label: "My Orders", icon: ClipboardList },
];

type Props = {
  userName: string;
  isAdmin: boolean;
};

export default function MainNav({ userName, isAdmin }: Props) {
  const pathname = usePathname();
  const cartCount = useCartStore((s) =>
    s.items.reduce((acc, i) => acc + i.quantity, 0),
  );
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* =============================================
          TOP HEADER (always visible)
          Mobile: Logo left | Cart + Avatar right
          Desktop: Logo left | Nav links center | Cart + Avatar right
         ============================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background border-b border-border flex items-center px-4 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logo.jpeg"
            alt="Edible Mart"
            width={40}
            height={10}
            className="object-contain invert"
            priority
          />
        </Link>

        {/* Desktop nav links — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1 ml-10">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side: Cart + User avatar */}
        <div className="ml-auto flex items-center gap-2">
          {/* Cart button with badge */}
          <Link href="/cart">
            <Button
              variant="ghost"
              size="icon"
              className="relative cursor-pointer"
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Button>
          </Link>

          {/* User avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full cursor-pointer"
                aria-label="Account"
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-[#1C0A06] text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">My account</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/admin"
                      className="cursor-pointer flex items-center gap-2"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Admin dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 cursor-pointer flex items-center gap-2"
                onClick={() => signOut()}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* =============================================
          BOTTOM TAB BAR — mobile only (md:hidden)
          WhatsApp-style: Home | Products | Orders | Cart
         ============================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-background border-t border-border flex items-center">
        {/* Home */}
        <BottomTab
          href="/"
          icon={Home}
          label="Home"
          active={pathname === "/"}
        />

        {/* Products */}
        <BottomTab
          href="/products"
          icon={ShoppingBasket}
          label="Products"
          active={pathname === "/products"}
        />

        {/* Orders */}
        <BottomTab
          href="/orders"
          icon={ClipboardList}
          label="My Orders"
          active={pathname === "/orders"}
        />

        {/* Cart with badge */}
        <Link
          href="/cart"
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative"
        >
          <div className="relative">
            <ShoppingCart
              className={cn(
                "w-5 h-5 transition-colors",
                pathname === "/cart" ? "text-primary" : "text-muted-foreground",
              )}
            />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[10px] font-medium transition-colors",
              pathname === "/cart" ? "text-primary" : "text-muted-foreground",
            )}
          >
            Cart
          </span>
        </Link>
      </nav>
    </>
  );
}

/* Small helper for bottom tab items */
function BottomTab({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
    >
      <Icon
        className={cn(
          "w-5 h-5 transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "text-[10px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
