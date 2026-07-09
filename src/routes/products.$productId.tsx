import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  Star,
  Heart,
  Share2,
  Minus,
  Plus,
  ShoppingCart,
  Truck,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PRODUCTS, type Product } from "@/lib/products";

export const Route = createFileRoute("/products/$productId")({
  loader: ({ params }): { product: Product; related: Product[] } => {
    const product = PRODUCTS.find((p) => p.id === params.productId);
    if (!product) throw notFound();
    const related = PRODUCTS.filter(
      (p) => p.category === product.category && p.id !== product.id,
    ).slice(0, 4);
    return { product, related };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} — FreshCart` },
          { name: "description", content: `Buy ${loaderData.product.name} (${loaderData.product.unit}) for $${loaderData.product.price.toFixed(2)}.` },
        ]
      : [{ title: "Product not found" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Product not found</h1>
      <p className="mt-2 text-muted-foreground">This product may have been removed.</p>
      <Button asChild className="mt-6"><Link to="/shop">Back to shop</Link></Button>
    </div>
  ),
  component: ProductDetail,
});

const VARIANTS_BY_CATEGORY: Record<string, { label: string; multiplier: number }[]> = {
  Fruits: [{ label: "500 g", multiplier: 0.55 }, { label: "1 kg", multiplier: 1 }, { label: "2 kg", multiplier: 1.9 }],
  Vegetables: [{ label: "250 g", multiplier: 0.3 }, { label: "500 g", multiplier: 0.55 }, { label: "1 kg", multiplier: 1 }],
  "Dairy & Eggs": [{ label: "Small", multiplier: 0.7 }, { label: "Regular", multiplier: 1 }, { label: "Family", multiplier: 1.8 }],
  Meat: [{ label: "500 g", multiplier: 1 }, { label: "1 kg", multiplier: 1.9 }],
  Seafood: [{ label: "300 g", multiplier: 1 }, { label: "500 g", multiplier: 1.6 }],
  Bakery: [{ label: "Regular", multiplier: 1 }, { label: "Large", multiplier: 1.5 }],
  Snacks: [{ label: "Standard", multiplier: 1 }, { label: "Family pack", multiplier: 2.2 }],
  Beverages: [{ label: "Single", multiplier: 1 }, { label: "6-pack", multiplier: 5.5 }],
};

const REVIEWS = [
  { name: "Sarah M.", rating: 5, date: "2 days ago", text: "Super fresh, arrived quickly. Will order again!" },
  { name: "James K.", rating: 4, date: "1 week ago", text: "Great quality for the price. Packaging was neat." },
  { name: "Priya S.", rating: 5, date: "3 weeks ago", text: "My family loved it. Became a weekly staple." },
];

function ProductDetail() {
  const { product, related } = Route.useLoaderData() as { product: Product; related: Product[] };
  const variants = VARIANTS_BY_CATEGORY[product.category] ?? [{ label: product.unit, multiplier: 1 }];
  const [variantIdx, setVariantIdx] = useState(
    Math.max(0, variants.findIndex((v) => v.label === product.unit)),
  );
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);

  const activeVariant = variants[variantIdx];
  const price = product.price * activeVariant.multiplier;
  const oldPrice = product.old ? product.old * activeVariant.multiplier : null;
  const discount = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  const gallery = [product.img];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">FreshCart</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded-3xl bg-secondary/40">
              <img src={gallery[imgIdx]} alt={product.name} className="h-full w-full object-cover" />
            </div>
          </div>


          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{product.category}</Badge>
              <Badge className="bg-accent text-accent-foreground hover:bg-accent">{product.tag}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{product.name}</h1>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-accent text-accent" : "text-muted"}`}
                  />
                ))}
                <span className="ml-1 font-medium">{product.rating}</span>
              </div>
              <span className="text-muted-foreground">·</span>
              <a href="#reviews" className="text-muted-foreground hover:underline">{product.reviews} reviews</a>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">Brand: <b className="text-foreground">{product.brand}</b></span>
            </div>

            <div className="mt-6 flex items-end gap-3">
              <span className="text-4xl font-bold">${price.toFixed(2)}</span>
              {oldPrice && (
                <span className="text-lg text-muted-foreground line-through">${oldPrice.toFixed(2)}</span>
              )}
              {discount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">-{discount}%</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Price per {activeVariant.label} · {product.inStock ? <span className="text-primary font-medium">In stock</span> : <span className="text-destructive font-medium">Out of stock</span>}
            </p>

            <div className="mt-8">
              <div className="text-sm font-semibold">Size</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {variants.map((v, i) => (
                  <button
                    key={v.label}
                    onClick={() => setVariantIdx(i)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      i === variantIdx
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:border-foreground/30"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="inline-flex items-center rounded-full border">
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setQty((q) => q + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button size="lg" className="flex-1 rounded-full" disabled={!product.inStock}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to cart · ${(price * qty).toFixed(2)}
              </Button>
              <Button size="icon" variant="outline" className="rounded-full"><Heart className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" className="rounded-full"><Share2 className="h-4 w-4" /></Button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { icon: Truck, label: "Free delivery over $30" },
                { icon: ShieldCheck, label: "Freshness guaranteed" },
                { icon: RefreshCw, label: "Easy returns" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded-xl border bg-card p-3 text-xs">
                  <f.icon className="h-4 w-4 text-primary" />
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Tabs defaultValue="details" className="mt-14">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Description</TabsTrigger>
            <TabsTrigger value="nutrition" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Nutrition</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Reviews ({product.reviews})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="pt-6">
            <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                Enjoy the finest {product.name.toLowerCase()} — hand-picked and delivered fresh to your door.
                Sourced from trusted {product.brand} suppliers, this product meets our strict quality standards.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Category: {product.category}</li>
                <li>Unit: {activeVariant.label}</li>
                <li>Storage: Keep refrigerated. Consume within recommended date.</li>
                <li>Origin: Locally sourced when in season.</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="nutrition" className="pt-6">
            <div className="max-w-md rounded-2xl border bg-card p-6">
              <h3 className="font-semibold">Nutrition per 100g</h3>
              <Separator className="my-3" />
              <dl className="space-y-2 text-sm">
                {[
                  ["Calories", "89 kcal"],
                  ["Protein", "1.1 g"],
                  ["Carbs", "22.8 g"],
                  ["Fat", "0.3 g"],
                  ["Fiber", "2.6 g"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="pt-6" id="reviews">
            <div className="grid gap-8 md:grid-cols-[280px_1fr]">
              <div className="rounded-2xl border bg-card p-6">
                <div className="text-5xl font-bold">{product.rating}</div>
                <div className="mt-1 flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-accent text-accent" : "text-muted"}`} />
                  ))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Based on {product.reviews} reviews</p>
                <Button className="mt-4 w-full">Write a review</Button>
              </div>
              <div className="space-y-6">
                {REVIEWS.map((r) => (
                  <div key={r.name} className="border-b pb-6 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.date}</div>
                    </div>
                    <div className="mt-1 flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-accent text-accent" : "text-muted"}`} />
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">You may also like</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => <RelatedCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function RelatedCard({ product }: { product: Product }) {
  return (
    <Link
      to="/products/$productId"
      params={{ productId: product.id }}
      className="group overflow-hidden rounded-2xl border bg-card transition hover:shadow-[var(--shadow-card)]"
    >
      <div className="aspect-square overflow-hidden bg-secondary/40">
        <img src={product.img} alt={product.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
      </div>
      <div className="p-4">
        <div className="text-xs text-muted-foreground">{product.unit}</div>
        <div className="mt-1 line-clamp-1 font-medium">{product.name}</div>
        <div className="mt-2 font-bold">${product.price.toFixed(2)}</div>
      </div>
    </Link>
  );
}
