import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";
import { Search, SlidersHorizontal, Star, Heart, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCTS, CATEGORIES, BRANDS, type Product } from "@/lib/products";

const PAGE_SIZE = 8;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  category: fallback(z.string(), "").default(""),
  brand: fallback(z.string(), "").default(""),
  min: fallback(z.number(), 0).default(0),
  max: fallback(z.number(), 20).default(20),
  sort: fallback(z.string(), "popular").default("popular"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/shop")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Shop — FreshCart" },
      { name: "description", content: "Browse fresh produce, pantry staples, and daily essentials." },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { q, category, brand, min, max, sort, page } = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });

  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });

  const filtered = useMemo(() => {
    let list = PRODUCTS.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (category && p.category !== category) return false;
      if (brand && p.brand !== brand) return false;
      if (p.price < min || p.price > max) return false;
      return true;
    });
    switch (sort) {
      case "price-asc": list = [...list].sort((a, b) => a.price - b.price); break;
      case "price-desc": list = [...list].sort((a, b) => b.price - a.price); break;
      case "rating": list = [...list].sort((a, b) => b.rating - a.rating); break;
      case "name": list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return list;
  }, [q, category, brand, min, max, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeFilters = [
    category && { label: category, clear: () => setSearch({ category: "" }) },
    brand && { label: brand, clear: () => setSearch({ brand: "" }) },
    (min > 0 || max < 20) && { label: `$${min}–$${max}`, clear: () => setSearch({ min: 0, max: 20 }) },
    q && { label: `"${q}"`, clear: () => setSearch({ q: "" }) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="min-h-screen bg-background">
      <TopBar q={q} onSearch={(v) => setSearch({ q: v })} />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav className="mb-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Shop</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <Sidebar
            category={category}
            brand={brand}
            min={min}
            max={max}
            onChange={setSearch}
          />

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {category || "All products"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Showing {pageItems.length} of {filtered.length} results
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <Select value={sort} onValueChange={(v) => setSearch({ sort: v })}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Most popular</SelectItem>
                    <SelectItem value="price-asc">Price: low to high</SelectItem>
                    <SelectItem value="price-desc">Price: high to low</SelectItem>
                    <SelectItem value="rating">Top rated</SelectItem>
                    <SelectItem value="name">Name: A–Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {activeFilters.map((f) => (
                  <button
                    key={f.label}
                    onClick={f.clear}
                    className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-xs font-medium hover:bg-muted"
                  >
                    {f.label}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            {pageItems.length === 0 ? (
              <div className="mt-16 rounded-2xl border bg-card p-12 text-center">
                <div className="text-5xl">🔍</div>
                <h3 className="mt-4 text-lg font-semibold">No products found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your filters or search.</p>
                <Button className="mt-4" onClick={() => navigate({ search: {} as never })}>
                  Reset filters
                </Button>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pageItems.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}

            {totalPages > 1 && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onChange={(p) => setSearch({ page: p })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({ q, onSearch }: { q: string; onSearch: (v: string) => void }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight">FreshCart</Link>
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            defaultValue={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search products…"
            className="h-11 rounded-full pl-11"
          />
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  category,
  brand,
  min,
  max,
  onChange,
}: {
  category: string;
  brand: string;
  min: number;
  max: number;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <aside className="space-y-6">
      <FilterBlock title="Categories">
        <div className="space-y-1">
          <button
            onClick={() => onChange({ category: "" })}
            className={`block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${!category ? "bg-muted font-medium" : ""}`}
          >
            All categories
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ category: c })}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${category === c ? "bg-muted font-medium" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Price range">
        <Slider
          value={[min, max]}
          min={0}
          max={20}
          step={0.5}
          onValueChange={([lo, hi]) => onChange({ min: lo, max: hi })}
        />
        <div className="mt-3 flex items-center justify-between text-sm">
          <span>${min.toFixed(2)}</span>
          <span>${max.toFixed(2)}</span>
        </div>
      </FilterBlock>

      <FilterBlock title="Brands">
        <div className="space-y-2">
          {BRANDS.map((b) => (
            <label key={b} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={brand === b}
                onCheckedChange={(v) => onChange({ brand: v ? b : "" })}
              />
              {b}
            </label>
          ))}
        </div>
      </FilterBlock>
    </aside>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const discount = product.old ? Math.round(((product.old - product.price) / product.old) * 100) : 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card transition hover:shadow-[var(--shadow-card)]">
      {discount > 0 && (
        <Badge className="absolute left-3 top-3 z-10 bg-destructive text-destructive-foreground hover:bg-destructive">
          -{discount}%
        </Badge>
      )}
      {!product.inStock && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Badge variant="secondary">Out of stock</Badge>
        </div>
      )}
      <Button size="icon" variant="ghost" className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-background/80">
        <Heart className="h-4 w-4" />
      </Button>
      <Link
        to="/products/$productId"
        params={{ productId: product.id }}
        className="block aspect-square overflow-hidden bg-secondary/40"
      >
        <img src={product.img} alt={product.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
      </Link>
      <div className="p-4">
        <div className="text-xs text-muted-foreground">{product.tag} • {product.unit}</div>
        <Link to="/products/$productId" params={{ productId: product.id }} className="mt-1 line-clamp-2 block font-medium leading-snug hover:text-primary">{product.name}</Link>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          <span className="font-medium text-foreground">{product.rating}</span>
          <span>({product.reviews})</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">${product.price.toFixed(2)}</div>
            {product.old && (
              <div className="text-xs text-muted-foreground line-through">${product.old.toFixed(2)}</div>
            )}
          </div>
          <Button size="icon" className="h-9 w-9 rounded-full" disabled={!product.inStock}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <Button variant="outline" size="icon" disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === page ? "default" : "outline"}
          size="icon"
          onClick={() => onChange(p)}
        >
          {p}
        </Button>
      ))}
      <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
