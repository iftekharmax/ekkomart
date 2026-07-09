import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Star } from "lucide-react";
import { PRODUCTS, CATEGORIES } from "@/lib/products";

export const Route = createFileRoute("/category/$name")({
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.name)} — FreshCart` },
      { name: "description", content: `Shop fresh ${decodeURIComponent(params.name)} online.` },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { name } = useParams({ from: "/category/$name" });
  const decoded = decodeURIComponent(name);
  const category = CATEGORIES.find((c) => c.toLowerCase() === decoded.toLowerCase()) ?? decoded;
  const items = PRODUCTS.filter((p) => p.category.toLowerCase() === decoded.toLowerCase());

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight">{category}</h1>
          <p className="text-xs text-muted-foreground">{items.length} products</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No products in this category yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <Link
                key={p.id}
                to="/products/$productId"
                params={{ productId: p.id }}
                className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-[var(--shadow-card)]"
              >
                <div className="aspect-square overflow-hidden bg-muted/40">
                  <img src={p.img} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="line-clamp-2 text-sm font-semibold leading-tight">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.unit}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="h-3 w-3 fill-accent text-accent" /> {p.rating} ({p.reviews})
                  </div>
                  <div className="mt-auto flex items-baseline gap-2 pt-1">
                    <span className="text-sm font-bold text-primary">${p.price.toFixed(2)}</span>
                    {p.old ? (
                      <span className="text-[11px] text-muted-foreground line-through">${p.old.toFixed(2)}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
