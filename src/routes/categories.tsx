import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Apple,
  Carrot,
  Milk,
  Beef,
  Fish,
  Sandwich,
  Cookie,
  Coffee,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { CATEGORIES } from "@/lib/products";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Categories — FreshCart" },
      { name: "description", content: "Browse groceries by category." },
    ],
  }),
  component: Categories,
});

const ICONS: Record<string, { icon: typeof Apple; tint: string }> = {
  Fruits: { icon: Apple, tint: "oklch(0.92 0.12 25)" },
  Vegetables: { icon: Carrot, tint: "oklch(0.92 0.13 130)" },
  "Dairy & Eggs": { icon: Milk, tint: "oklch(0.94 0.06 85)" },
  Meat: { icon: Beef, tint: "oklch(0.88 0.14 20)" },
  Seafood: { icon: Fish, tint: "oklch(0.9 0.09 220)" },
  Bakery: { icon: Sandwich, tint: "oklch(0.92 0.09 70)" },
  Snacks: { icon: Cookie, tint: "oklch(0.9 0.11 55)" },
  Beverages: { icon: Coffee, tint: "oklch(0.9 0.08 40)" },
};

function Categories() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="rounded-full p-1 hover:bg-muted md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold tracking-tight">Categories</h1>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Mobile: 3-col icon grid */}
        <div className="grid grid-cols-3 gap-3 sm:hidden">
          {CATEGORIES.map((c) => {
            const meta = ICONS[c];
            const Icon = meta.icon;
            return (
              <Link
                key={c}
                to="/category/$name"
                params={{ name: c }}
                className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center transition active:scale-95"
              >
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: meta.tint }}
                >
                  <Icon className="h-7 w-7 text-foreground/80" />
                </div>
                <span className="text-xs font-medium leading-tight">{c}</span>
              </Link>
            );
          })}
        </div>

        {/* Tablet/desktop: list rows */}
        <div className="hidden grid-cols-2 gap-3 sm:grid lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const meta = ICONS[c];
            const Icon = meta.icon;
            return (
              <Link
                key={c}
                to="/category/$name"
                params={{ name: c }}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:shadow-[var(--shadow-card)]"
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: meta.tint }}
                >
                  <Icon className="h-7 w-7 text-foreground/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c}</div>
                  <div className="text-xs text-muted-foreground">Shop {c.toLowerCase()}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
