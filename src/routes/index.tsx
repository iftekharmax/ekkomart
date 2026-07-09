import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS, type Product } from "@/lib/products";
import { CategoryDrawer } from "@/components/category-drawer";
import {
  Search,
  ShoppingCart,
  MapPin,
  User,
  Heart,
  Menu,
  Clock,
  Truck,
  ShieldCheck,
  Percent,
  Apple,
  Milk,
  Beef,
  Fish,
  Cookie,
  Coffee,
  Carrot,
  Sandwich,
  
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import heroImage from "@/assets/hero-groceries.jpg";
import banner1 from "@/assets/banner-1.jpg";
import banner2 from "@/assets/banner-2.jpg";
import banner3 from "@/assets/banner-3.jpg";
import catBev from "@/assets/categories/beverages.png";
import catFruit from "@/assets/categories/c2.jpeg";
import catVeg from "@/assets/categories/c3.jpeg";
import catRice from "@/assets/categories/rice.jpg";
import catDairy from "@/assets/categories/c5.jpeg";
import catBakery from "@/assets/categories/c6.jpg";
import catMeatFish from "@/assets/categories/meatfish.jpeg";

export const Route = createFileRoute("/")({
  component: Home,
});

const categories = [
  { name: "Fresh Fruits", image: catFruit },
  { name: "Vegetables", image: catVeg },
  { name: "Dairy & Eggs", image: catDairy },
  { name: "Meat", image: catMeatFish },
  { name: "Seafood", image: catMeatFish },
  { name: "Bakery", image: catBakery },
  { name: "Snacks", image: catRice },
  { name: "Beverages", image: catBev },
];

const products = PRODUCTS.slice(0, 8);

const brands = [
  { name: "Nestlé", logo: "https://icons.duckduckgo.com/ip3/nestle.com.ico" },
  { name: "Kellogg's", logo: "https://icons.duckduckgo.com/ip3/kelloggs.com.ico" },
  { name: "Coca-Cola", logo: "https://icons.duckduckgo.com/ip3/coca-cola.com.ico" },
  { name: "Pepsi", logo: "https://icons.duckduckgo.com/ip3/pepsi.com.ico" },
  { name: "Heinz", logo: "https://icons.duckduckgo.com/ip3/heinz.com.ico" },
  { name: "Kraft", logo: "https://icons.duckduckgo.com/ip3/kraftheinzcompany.com.ico" },
  { name: "Danone", logo: "https://icons.duckduckgo.com/ip3/danone.com.ico" },
  { name: "Barilla", logo: "https://icons.duckduckgo.com/ip3/barilla.com.ico" },
  { name: "Nescafé", logo: "https://icons.duckduckgo.com/ip3/nescafe.com.ico" },
  { name: "Oreo", logo: "https://icons.duckduckgo.com/ip3/oreo.com.ico" },
  { name: "Lay's", logo: "https://icons.duckduckgo.com/ip3/lays.com.ico" },
  { name: "Nutella", logo: "https://icons.duckduckgo.com/ip3/nutella.com.ico" },
];

function useCountdown(hours: number) {
  const [target] = useState(() => Date.now() + hours * 3600 * 1000);
  const [left, setLeft] = useState(target - Date.now());
  useEffect(() => {
    const i = setInterval(() => setLeft(target - Date.now()), 1000);
    return () => clearInterval(i);
  }, [target]);
  const s = Math.max(0, Math.floor(left / 1000));
  return {
    h: String(Math.floor(s / 3600)).padStart(2, "0"),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
    s: String(s % 60).padStart(2, "0"),
  };
}

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        
        <Categories />
        <FlashSale />
        <ProductGrid title="Best Sellers" />
        
        <ProductGrid title="New Arrivals" />
        <Brands />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="hidden border-b bg-primary/5 py-2 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>Deliver to <b className="text-foreground">New York, 10001</b></span>
          </div>
          <div className="flex items-center gap-4">
            <span>Help</span>
            <span>Track order</span>
            <span>EN / USD</span>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
        <CategoryDrawer
          trigger={
            <button className="lg:hidden" aria-label="Open categories">
              <Menu className="h-6 w-6" />
            </button>
          }
        />
        <a href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Carrot className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Tokyohalal</span>
        </a>
        <div className="hidden flex-1 lg:block">
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for fruits, vegetables, snacks…"
              className="h-11 rounded-full border-border pl-11 pr-28"
            />
            <Button size="sm" className="absolute right-1.5 top-1.5 h-8 rounded-full">Search</Button>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="hidden md:inline-flex"><Heart className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="hidden md:inline-flex"><User className="h-5 w-5" /></Button>
          <Button variant="ghost" className="relative gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline">Cart</span>
            <Badge className="absolute -right-1 -top-1 h-5 w-5 justify-center rounded-full p-0">3</Badge>
          </Button>
        </div>
      </div>
      <div className="border-t px-4 py-2 lg:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search groceries…" className="h-10 rounded-full pl-10" />
        </div>
      </div>
    </header>
  );
}

const BANNERS = [banner1, banner2, banner3];

function Hero() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % BANNERS.length), 4500);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="relative overflow-hidden rounded-3xl bg-muted">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {BANNERS.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Banner ${i + 1}`}
              width={1600}
              height={600}
              loading={i === 0 ? "eager" : "lazy"}
              className="min-w-full object-cover aspect-[16/6]"
            />
          ))}
        </div>


      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Truck, title: "Free delivery", desc: "On orders over $30" },
    { icon: Clock, title: "30-min delivery", desc: "Lightning fast" },
    { icon: ShieldCheck, title: "Fresh guarantee", desc: "Or full refund" },
    { icon: Percent, title: "Daily deals", desc: "Up to 50% off" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-5">
      <div className="grid gap-4 md:grid-cols-4">
        {items.map((f) => (
          <div key={f.title} className="flex items-center gap-4 rounded-2xl border bg-card p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Categories() {
  const perView = 4;
  const pages = Math.ceil(categories.length / perView);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % pages), 3000);
    return () => clearInterval(t);
  }, [pages]);
  return (
    <section className="mx-auto max-w-7xl px-4 py-5">
      <SectionHeading title="Category" />
      <div className="mt-5 overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {Array.from({ length: pages }).map((_, p) => (
            <div key={p} className="grid min-w-full grid-cols-4 gap-2 sm:gap-4">
              {categories.slice(p * perView, p * perView + perView).map((c) => (
                <Link
                  key={c.name}
                  to="/category/$name"
                  params={{ name: c.name }}
                  className="group flex min-w-0 flex-col items-center rounded-2xl border bg-card p-2 text-center transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)] sm:p-4"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-secondary/40 sm:h-16 sm:w-16">
                    <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-2 w-full truncate text-xs font-medium sm:mt-3 sm:text-sm">{c.name}</div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCarousel({ items }: { items: Product[] }) {
  return (
    <div className="mt-6 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex snap-x snap-mandatory gap-2 sm:gap-4">
        {items.map((prod) => (
          <div
            key={prod.id}
            className="w-[calc((100%-1rem)/3)] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)]"
          >
            <ProductCard product={prod} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlashSale() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-medium tracking-tight md:text-3xl">Flash Sale</h2>
        <Link
          to="/shop"
          className="inline-flex items-center gap-1 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-green-900 transition hover:bg-green-100"
        >
          More <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ProductCarousel items={products.slice(0, 6)} />
    </section>
  );
}

function ProductGrid({ title }: { title: string; subtitle?: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-5">
      <div className="flex items-center justify-between">
        <SectionHeading title={title} />
        <Link
          to="/shop"
          className="inline-flex items-center gap-1 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-green-900 transition hover:bg-green-100"
        >
          More <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ProductCarousel items={products} />
    </section>
  );
}

function ProductCard({ product }: { product: Product; flash?: boolean }) {
  const discount = product.old ? Math.round(((product.old - product.price) / product.old) * 100) : 0;
  return (
    <div className="group relative flex h-full min-w-0 flex-col overflow-hidden border bg-card transition hover:shadow-[var(--shadow-card)]">
      {discount > 0 && (
        <Badge className="absolute left-2 top-2 z-10 h-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground hover:bg-destructive">
          -{discount}%
        </Badge>
      )}
      <Button size="icon" variant="ghost" className="absolute right-1.5 top-1.5 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur">
        <Heart className="h-3.5 w-3.5" />
      </Button>
      <Link
        to="/products/$productId"
        params={{ productId: product.id }}
        className="block aspect-[4/3] overflow-hidden bg-secondary/40 p-2"
      >
        <img src={product.img} alt={product.name} loading="lazy" className="h-full w-full object-contain transition group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col p-2 sm:p-3">
        <Link
          to="/products/$productId"
          params={{ productId: product.id }}
          className="block truncate text-xs font-medium leading-snug hover:text-primary sm:text-sm"
        >
          {product.name}
        </Link>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="text-sm font-bold text-foreground sm:text-base">${product.price.toFixed(2)}</span>
          {product.old && (
            <span className="text-[11px] text-muted-foreground line-through">${product.old.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PromoBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-8 text-primary-foreground">
          <div className="max-w-xs">
            <div className="text-xs uppercase tracking-widest opacity-80">Weekend Special</div>
            <h3 className="mt-2 text-3xl font-bold leading-tight">Save 30% on fresh produce</h3>
            <Button variant="secondary" className="mt-6 rounded-full">Shop produce</Button>
          </div>
          <div className="absolute -bottom-6 -right-6 text-[10rem] opacity-20">🥦</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-accent p-8 text-accent-foreground">
          <div className="max-w-xs">
            <div className="text-xs uppercase tracking-widest opacity-80">Combo Deal</div>
            <h3 className="mt-2 text-3xl font-bold leading-tight">Breakfast bundle from $9.99</h3>
            <Button className="mt-6 rounded-full">Grab combo</Button>
          </div>
          <div className="absolute -bottom-6 -right-6 text-[10rem] opacity-20">🥐</div>
        </div>
      </div>
    </section>
  );
}

function Brands() {
  const perView = 4;
  const pages = Math.ceil(brands.length / perView);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pages), 2500);
    return () => clearInterval(t);
  }, [pages, paused]);
  return (
    <section className="mx-auto max-w-7xl px-4 py-5">
      <SectionHeading title="Top brands" />
      <div
        className="mt-6 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {Array.from({ length: pages }).map((_, p) => (
            <div key={p} className="grid min-w-full grid-cols-4 gap-3">
              {brands.slice(p * perView, p * perView + perView).map((b) => (
                <div
                  key={b.name}
                  className="flex h-20 items-center justify-center rounded-xl border bg-card p-3 transition hover:shadow-[var(--shadow-card)]"
                >
                  <img
                    src={b.logo}
                    alt={b.name}
                    loading="lazy"
                    className="max-h-12 max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="rounded-3xl border bg-secondary/50 p-8 text-center md:p-14">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Get $5 off your first order</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Join our newsletter for exclusive deals, recipes, and fresh product drops.
        </p>
        <form className="mx-auto mt-6 flex max-w-md gap-2">
          <Input placeholder="Enter your email" type="email" className="h-11 rounded-full bg-background" />
          <Button className="h-11 rounded-full px-6">Subscribe</Button>
        </form>
      </div>
    </section>
  );
}

function SectionHeading({ title }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-medium tracking-tight md:text-3xl">{title}</h2>
    </div>
  );
}

function Footer() {
  const cols = [
    { title: "Shop", links: ["Fruits & Vegetables", "Meat & Poultry", "Dairy & Eggs", "Bakery"] },
    { title: "Support", links: ["Help Center", "Order Tracking", "Delivery Areas", "Returns & Refunds"] },
    { title: "Company", links: ["About Us", "Careers", "Press", "Sustainability"] },
    { title: "Legal", links: ["Terms of Service", "Privacy Policy", "Cookie Policy", "Licenses"] },
  ];
  return (
    <footer className="mt-10 bg-background">
      <div className="mx-auto max-w-7xl border-t border-secondary px-4 pb-12 pt-16">
        <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Carrot className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-foreground">Tokyohalal</span>
            </div>
            <p className="max-w-xs leading-relaxed text-muted-foreground">
              Your premier destination for high-quality, fresh halal groceries delivered directly to your doorstep across the city.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#"
                aria-label="Download on the App Store"
                className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-background transition-opacity hover:opacity-90"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.42 2.22-1.11 3.03-.75.87-1.98 1.55-3.18 1.46-.15-1.12.42-2.28 1.1-3.03.77-.86 2.07-1.5 3.19-1.46zM20.5 17.36c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.39 3.5-4.12 3.52-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.06-1.77-4.05-3.33-2.77-4.36-3.06-9.48-1.35-12.2 1.21-1.93 3.13-3.06 4.93-3.06 1.83 0 2.98 1.01 4.49 1.01 1.47 0 2.36-1.01 4.48-1.01 1.6 0 3.29.87 4.49 2.37-3.95 2.17-3.31 7.82.75 8.75z" />
                </svg>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] leading-none">Download on the</span>
                  <span className="text-sm font-semibold">App Store</span>
                </div>
              </a>
              <a
                href="#"
                aria-label="Get it on Google Play"
                className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-background transition-opacity hover:opacity-90"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                  <path fill="#EA4335" d="M3.6 2.3c-.4.4-.6 1-.6 1.8v15.8c0 .8.2 1.4.6 1.8l12-11.7-12-7.7z" />
                  <path fill="#FBBC04" d="M17.6 14.2l3.2-1.8c1-.6 1-2.2 0-2.8l-3.2-1.8-3.5 3.2 3.5 3.2z" />
                  <path fill="#4285F4" d="M15.6 10l-12-7.7 12 11.7 3.5-3.2-3.5-.8z" />
                  <path fill="#34A853" d="M3.6 21.7l12-7.7-3.5-3.2-8.5 10.9z" />
                </svg>
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] leading-none">Get it on</span>
                  <span className="text-sm font-semibold">Google Play</span>
                </div>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:col-span-8">
            {cols.map((c) => (
              <div key={c.title} className="space-y-4">
                <h4 className="font-semibold text-foreground">{c.title}</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="transition-colors hover:text-primary">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-secondary pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Tokyohalal. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" aria-label="Facebook" className="text-muted-foreground transition-colors hover:text-primary">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="#" aria-label="Twitter" className="text-muted-foreground transition-colors hover:text-primary">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
            </a>
            <a href="#" aria-label="Instagram" className="text-muted-foreground transition-colors hover:text-primary">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
