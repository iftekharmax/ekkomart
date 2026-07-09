import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CATEGORIES } from "@/lib/products";

const CATEGORY_ICONS: Record<
  string,
  { icon: typeof Apple; gradient: string; count: number }
> = {
  Fruits: { icon: Apple, gradient: "from-rose-400 to-red-500", count: 24 },
  Vegetables: { icon: Carrot, gradient: "from-lime-400 to-emerald-500", count: 32 },
  "Dairy & Eggs": { icon: Milk, gradient: "from-amber-300 to-orange-400", count: 18 },
  Meat: { icon: Beef, gradient: "from-red-400 to-rose-600", count: 14 },
  Seafood: { icon: Fish, gradient: "from-sky-400 to-blue-500", count: 12 },
  Bakery: { icon: Sandwich, gradient: "from-amber-400 to-yellow-500", count: 21 },
  Snacks: { icon: Cookie, gradient: "from-orange-400 to-pink-500", count: 40 },
  Beverages: { icon: Coffee, gradient: "from-teal-400 to-cyan-500", count: 27 },
};

export function CategoryDrawer({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="left"
        className="w-[85%] max-w-sm gap-0 border-r bg-background p-0 sm:max-w-sm [&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:opacity-100"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Shop by Category</SheetTitle>
        </SheetHeader>
        <div className="h-12 shrink-0" />

        <ul className="flex flex-col divide-y overflow-y-auto py-1">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_ICONS[c];
            const Icon = meta.icon;
            return (
              <li key={c}>
                <Link
                  to="/category/$name"
                  params={{ name: c }}
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-3 px-4 py-2.5 text-foreground transition-colors hover:bg-muted/60 active:bg-muted"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient}`}
                  >
                    <Icon className="h-4 w-4 text-white" strokeWidth={2.4} />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
