import { useMemo, useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { posSearchProducts, createPosSale } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Minus, Plus, Trash2, Search, ScanLine, ShoppingCart, Wallet, X, Receipt, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pos")({
  head: () => ({ meta: [{ title: "POS — Tokyohalal" }] }),
  component: PosPage,
});

type Product = {
  id: string; name: string; sku: string | null; barcode: string | null;
  price: number; stock: number | null; img: string | null; unit: string | null;
};
type CartItem = Product & { qty: number };

const money = (n: number) => `৳${n.toFixed(2)}`;

function PosPage() {
  const searchFn = useServerFn(posSearchProducts);
  const saleFn = useServerFn(createPosSale);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 200); return () => clearTimeout(t); }, [q]);

  const { data: products = [], isFetching } = useQuery({
    queryKey: ["pos-products", debouncedQ],
    queryFn: () => searchFn({ data: { q: debouncedQ, limit: 36 } }) as Promise<Product[]>,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState<null | { id: string; total: number }>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const subtotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);
  const total = Math.max(0, subtotal - discount + tax);
  const change = Math.max(0, paid - total);

  function addToCart(p: Product) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const next = copy[idx].qty + 1;
        if (p.stock != null && next > p.stock) {
          toast.error(`Only ${p.stock} in stock`);
          return prev;
        }
        copy[idx] = { ...copy[idx], qty: next };
        return copy;
      }
      if (p.stock != null && p.stock <= 0) { toast.error("Out of stock"); return prev; }
      return [...prev, { ...p, qty: 1 }];
    });
  }
  function setQty(id: string, qty: number) {
    setCart((prev) => prev.flatMap((it) => {
      if (it.id !== id) return [it];
      if (qty <= 0) return [];
      if (it.stock != null && qty > it.stock) { toast.error(`Only ${it.stock} in stock`); return [it]; }
      return [{ ...it, qty }];
    }));
  }
  function remove(id: string) { setCart((prev) => prev.filter((i) => i.id !== id)); }
  function clearAll() { setCart([]); setDiscount(0); setTax(0); setPaid(0); setCustomer(""); }

  // Barcode-scan behavior: Enter on search field with exact match → add.
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const term = q.trim().toLowerCase();
    if (!term) return;
    const exact = (products as Product[]).find(
      (p) => (p.barcode ?? "").toLowerCase() === term || (p.sku ?? "").toLowerCase() === term,
    );
    if (exact) { addToCart(exact); setQ(""); }
  }

  const sale = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");
      if (paid < total) throw new Error("Paid amount is less than total");
      const res = await saleFn({ data: {
        items: cart.map((c) => ({ product_id: c.id, name: c.name, price: c.price, qty: c.qty, img: c.img })),
        discount, tax, paid, payment_method: method, customer: customer || null,
      } });
      return res as { id: string; total: number };
    },
    onSuccess: (res) => {
      setReceipt(res);
      clearAll();
      toast.success("Sale completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="-m-4 grid gap-4 p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:h-[calc(100dvh-2rem)] lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden lg:p-6">
      {/* LEFT: Products */}
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-primary/5 to-transparent p-4 dark:border-slate-800">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search or scan barcode / SKU / name…"
              className="pl-9"
            />
          </div>
          <span className="hidden items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 sm:inline-flex dark:border-slate-800">
            <ScanLine className="h-3.5 w-3.5" /> Scanner ready
          </span>
        </div>

        {isFetching && (products as Product[]).length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : (products as Product[]).length === 0 ? (
          <div className="grid place-items-center py-16 text-sm text-slate-500">No products found.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {(products as Product[]).map((p) => {
              const out = (p.stock ?? 0) <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className={`group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950`}
                >
                  <div className="aspect-square w-full bg-slate-50 dark:bg-slate-900">
                    {p.img ? (
                      <img src={p.img} alt={p.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full place-items-center text-slate-300">
                        <ShoppingCart className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-2.5">
                    <div className="line-clamp-2 min-h-[2.5rem] text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {p.name}
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-sm font-bold text-primary">{money(Number(p.price))}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${out ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                        {out ? "Out" : `${p.stock} ${p.unit ?? "pcs"}`}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* RIGHT: Cart */}
      <aside className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-bold">Current sale</div>
              <div className="text-[11px] text-slate-500">{cart.length} item(s)</div>
            </div>
          </div>
          {cart.length > 0 && (
            <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </header>

        <div className="max-h-[42vh] flex-1 overflow-y-auto p-3 lg:max-h-none">
          {cart.length === 0 ? (
            <div className="grid place-items-center py-14 text-center text-sm text-slate-500">
              <ShoppingCart className="mb-2 h-8 w-8 text-slate-300" />
              Click products to add them.
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((it) => (
                <li key={it.id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    {it.img ? <img src={it.img} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-slate-500">{money(Number(it.price))} × {it.qty} = <b className="text-slate-800 dark:text-slate-100">{money(Number(it.price) * it.qty)}</b></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(it.id, it.qty - 1)} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Minus className="h-3.5 w-3.5" /></button>
                    <input
                      value={it.qty}
                      onChange={(e) => setQty(it.id, Math.max(0, Number(e.target.value) || 0))}
                      className="h-7 w-10 rounded-md border border-slate-200 bg-transparent text-center text-sm dark:border-slate-700"
                    />
                    <button onClick={() => setQty(it.id, it.qty + 1)} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <button onClick={() => remove(it.id)} className="ml-1 grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">Customer
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" className="mt-1 h-9" />
            </label>
            <label className="text-xs text-slate-500">Method
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs text-slate-500">Discount
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="mt-1 h-9" />
            </label>
            <label className="text-xs text-slate-500">Tax
              <Input type="number" min={0} value={tax} onChange={(e) => setTax(Math.max(0, Number(e.target.value) || 0))} className="mt-1 h-9" />
            </label>
          </div>

          <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
            <Row label="Subtotal" value={money(subtotal)} />
            <Row label="Discount" value={`− ${money(discount)}`} />
            <Row label="Tax" value={`+ ${money(tax)}`} />
            <div className="my-1 border-t border-dashed border-slate-200 dark:border-slate-800" />
            <Row label={<span className="font-bold text-slate-900 dark:text-slate-100">Total</span>} value={<span className="text-lg font-black text-primary">{money(total)}</span>} />
          </div>

          <div className="mt-3">
            <label className="text-xs text-slate-500">Amount received</label>
            <div className="mt-1 flex gap-2">
              <Input type="number" min={0} value={paid} onChange={(e) => setPaid(Math.max(0, Number(e.target.value) || 0))} className="h-10 flex-1" />
              <Button type="button" variant="outline" className="h-10" onClick={() => setPaid(total)}>Exact</Button>
            </div>
            <div className={`mt-1 text-xs ${paid >= total ? "text-emerald-600" : "text-rose-600"}`}>
              {paid >= total ? `Change: ${money(change)}` : `Remaining: ${money(total - paid)}`}
            </div>
          </div>

          <Button
            onClick={() => sale.mutate()}
            disabled={sale.isPending || cart.length === 0 || paid < total}
            className="mt-3 h-12 w-full text-base font-bold"
          >
            <Wallet className="mr-2 h-5 w-5" />
            {sale.isPending ? "Processing…" : `Complete sale · ${money(total)}`}
          </Button>
        </div>
      </aside>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Sale completed</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-500"><Receipt className="h-4 w-4" /> Sale ID</div>
              <div className="rounded-lg bg-slate-50 p-2 font-mono text-xs dark:bg-slate-900">{receipt.id}</div>
              <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-black text-primary">{money(receipt.total)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
            <Button onClick={() => setReceipt(null)}>New sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
