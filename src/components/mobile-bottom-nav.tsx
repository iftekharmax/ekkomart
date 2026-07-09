import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, ShoppingCart, Heart, User } from "lucide-react";

const items = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/categories", label: "Category", icon: LayoutGrid, exact: false },
  { to: "/cart", label: "Cart", icon: ShoppingCart, exact: false, badge: 3 },
  { to: "/wishlist", label: "Wishlist", icon: Heart, exact: false },
  { to: "/profile", label: "Profile", icon: User, exact: false },
] as const;

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={`relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <it.icon className="h-5 w-5" />
                <span>{it.label}</span>
                {"badge" in it && it.badge ? (
                  <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
