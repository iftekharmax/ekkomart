import { useMemo, useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { posSearchProducts, createPosSale, createPosQuickProduct } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Minus, Plus, Trash2, Search, ScanLine, ShoppingCart, Wallet, X, Receipt, CheckCircle2, Package,
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
  const quickAddFn = useServerFn(createPosQuickProduct);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 150); return () => clearTimeout(t); }, [q]);

  const { data: suggestions = [], isFetching } = useQuery({
    queryKey: ["pos-suggest", debouncedQ],
    queryFn: () => searchFn({ data: { q: debouncedQ, limit: 8 } }) as Promise<Product[]>,
    enabled: debouncedQ.trim().length > 0,
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState<null | { id: string; total: number }>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<null | { code: string }>(null);
  const [quickName, setQuickName] = useState("");
  const [quickPrice, setQuickPrice] = useState<number>(0);
  const [quickStock, setQuickStock] = useState<number>(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const bufferRef = useRef<string>("");
  const justAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const subtotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);
  const total = Math.max(0, subtotal - discount + tax);
  const change = Math.max(0, paid - total);

  function flashAdded(id: string) {
    setJustAddedId(id);
    if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
    justAddedTimer.current = setTimeout(() => setJustAddedId(null), 1200);
  }

  function addToCart(p: Product) {
    let ok = true;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const next = copy[idx].qty + 1;
        if (p.stock != null && next > p.stock) {
          toast.error(`Only ${p.stock} in stock`); ok = false; return prev;
        }
        copy[idx] = { ...copy[idx], qty: next };
        return copy;
      }
      if (p.stock != null && p.stock <= 0) { toast.error("Out of stock"); ok = false; return prev; }
      return [...prev, { ...p, qty: 1 }];
    });
    if (ok) {
      flashAdded(p.id);
      toast.success(`Added: ${p.name}`, { duration: 1200 });
    }
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

  function openNotFound(code: string) {
    setNotFound({ code });
    setQuickName("");
    setQuickPrice(0);
    setQuickStock(1);
  }

  // Hardware barcode scanner: emits keys very fast + Enter. Detect by inter-key timing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isFormEl = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (target?.isContentEditable ?? false);

      // Global shortcut: Ctrl/Cmd+F focus scanner (works from anywhere)
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      if (isFormEl && target !== searchRef.current) return;

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= 3) {
          void (async () => {
            const rows = (await searchFn({ data: { q: code, limit: 5 } })) as Product[];
            const exact = rows.find((p) => (p.barcode ?? "").toLowerCase() === code.toLowerCase() || (p.sku ?? "").toLowerCase() === code.toLowerCase()) ?? rows[0];
            if (exact) { addToCart(exact); setQ(""); setOpen(false); searchRef.current?.focus(); }
            else openNotFound(code);
          })();
        }
        return;
      }
      if (e.key.length === 1) {
        if (gap > 60) bufferRef.current = "";
        bufferRef.current += e.key;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchFn]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Escape") { e.preventDefault(); setQ(""); setOpen(false); setActiveIdx(0); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const picked = suggestions[activeIdx];
      if (picked) { addToCart(picked); setQ(""); setOpen(false); setActiveIdx(0); searchRef.current?.focus(); }
      else if (q.trim().length >= 2 && !isFetching && suggestions.length === 0) {
        openNotFound(q.trim());
      }
    }
  }

  const quickAdd = useMutation({
    mutationFn: async () => {
      if (!quickName.trim()) throw new Error("Name is required");
      const code = notFound?.code ?? "";
      const looksLikeBarcode = /^\d{6,}$/.test(code);
      const res = await quickAddFn({ data: {
        name: quickName.trim(), price: quickPrice, stock: quickStock,
        barcode: looksLikeBarcode ? code : null,
        sku: !looksLikeBarcode && code ? code : null,
      } });
      return res as Product;
    },
    onSuccess: (p) => {
      addToCart(p);
      setNotFound(null);
      setQ("");
      searchRef.current?.focus();
      toast.success(`Created & added: ${p.name}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sale = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Cart is empty");
      if (paid < total) throw new Error("Paid amount is less than total");
      const snapshot = {
        items: cart.map((c) => ({ name: c.name, price: Number(c.price), qty: c.qty })),
        subtotal, discount, tax, total, paid, change, method,
        customer: customer || "Walk-in",
      };
      const res = await saleFn({ data: {
        items: cart.map((c) => ({ product_id: c.id, name: c.name, price: c.price, qty: c.qty, img: c.img })),
        discount, tax, paid, payment_method: method, customer: customer || null,
      } });
      return { res: res as { id: string; total: number }, snapshot };
    },
    onSuccess: ({ res, snapshot }) => {
      setReceipt(res);
      printThermalReceipt({ id: res.id, ...snapshot });
      clearAll();
      toast.success("Sale completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="-m-4 grid gap-4 p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:h-[calc(100dvh-2rem)] lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden lg:p-6">
      {/* LEFT: Scan/Search + Cart items summary */}
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Scanner header */}
        <div className="border-b border-slate-200 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 dark:border-slate-800">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold">Scan or search a product</div>
              <div className="text-xs text-slate-500">Use a barcode scanner, or type a name / SKU / barcode</div>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); setActiveIdx(0); }}
              onKeyDown={onSearchKey}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Scan barcode or start typing…"
              className="h-14 rounded-xl border-2 border-primary/20 pl-12 pr-4 text-base font-medium shadow-sm focus-visible:border-primary focus-visible:ring-primary/20"
            />
            {open && q.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {isFetching && suggestions.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">Searching…</div>
                ) : suggestions.length === 0 ? (
                  <div className="p-4">
                    <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">No products found for <b>"{q}"</b></div>
                    <Button size="sm" type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => openNotFound(q.trim())}>
                      <Plus className="mr-1 h-4 w-4" /> Add "{q}" manually
                    </Button>
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {suggestions.map((p, i) => {
                      const out = (p.stock ?? 0) <= 0;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { addToCart(p); setQ(""); setOpen(false); searchRef.current?.focus(); }}
                            onMouseEnter={() => setActiveIdx(i)}
                            disabled={out}
                            className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-0 dark:border-slate-800 ${i === activeIdx ? "bg-primary/5" : "hover:bg-slate-50 dark:hover:bg-slate-800"} disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                              {p.img ? <img src={p.img} alt="" className="h-full w-full object-cover" /> : (
                                <div className="grid h-full place-items-center text-slate-300"><Package className="h-5 w-5" /></div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</div>
                              <div className="truncate text-[11px] text-slate-500">
                                {p.sku ? `SKU ${p.sku}` : ""}{p.sku && p.barcode ? " · " : ""}{p.barcode ? `Barcode ${p.barcode}` : ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-primary">{money(Number(p.price))}</div>
                              <div className={`text-[10px] font-semibold ${out ? "text-rose-600" : "text-emerald-600"}`}>
                                {out ? "Out of stock" : `${p.stock} ${p.unit ?? "pcs"}`}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart list (moved to left, spacious) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Cart ({cart.length})</span>
            </div>
            {cart.length > 0 && (
              <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="grid h-full place-items-center py-16 text-center text-sm text-slate-500">
                <div>
                  <ScanLine className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                  <div className="font-medium">Ready to scan</div>
                  <div className="text-xs">Scan a barcode or search above to add items.</div>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((it) => (
                  <li key={it.id} className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm transition-all ${justAddedId === it.id ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 dark:border-emerald-500 dark:bg-emerald-950/40" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}>
                    {justAddedId === it.id && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                      {it.img ? <img src={it.img} alt="" className="h-full w-full object-cover" /> : (
                        <div className="grid h-full place-items-center text-slate-300"><Package className="h-5 w-5" /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{it.name}</div>
                      <div className="text-xs text-slate-500">{money(Number(it.price))} × {it.qty} = <b className="text-slate-800 dark:text-slate-100">{money(Number(it.price) * it.qty)}</b></div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(it.id, it.qty - 1)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Minus className="h-3.5 w-3.5" /></button>
                      <input
                        value={it.qty}
                        onChange={(e) => setQty(it.id, Math.max(0, Number(e.target.value) || 0))}
                        className="h-8 w-12 rounded-md border border-slate-200 bg-transparent text-center text-sm dark:border-slate-700"
                      />
                      <button onClick={() => setQty(it.id, it.qty + 1)} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <button onClick={() => remove(it.id)} className="ml-1 grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT: Checkout */}
      <aside className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-primary/10 to-transparent px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-bold">Checkout</div>
              <div className="text-[11px] text-slate-500">Review & complete sale</div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <Button
            onClick={() => sale.mutate()}
            disabled={sale.isPending || cart.length === 0 || paid < total}
            className="h-12 w-full text-base font-bold"
          >
            <Wallet className="mr-2 h-5 w-5" />
            {sale.isPending ? "Processing…" : `Pay · ${money(total)}`}
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
            <Button onClick={() => { setReceipt(null); searchRef.current?.focus(); }}>New sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!notFound} onOpenChange={(o) => !o && setNotFound(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Product not found</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              No product matched <b>"{notFound?.code}"</b>. Add it now to continue checkout.
            </div>
            <label className="block text-xs text-slate-500">Name
              <Input autoFocus value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="Product name" className="mt-1 h-9" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-500">Price
                <Input type="number" min={0} step="0.01" value={quickPrice} onChange={(e) => setQuickPrice(Math.max(0, Number(e.target.value) || 0))} className="mt-1 h-9" />
              </label>
              <label className="block text-xs text-slate-500">Stock
                <Input type="number" min={0} value={quickStock} onChange={(e) => setQuickStock(Math.max(0, Number(e.target.value) || 0))} className="mt-1 h-9" />
              </label>
            </div>
            <div className="text-[11px] text-slate-500">
              {/^\d{6,}$/.test(notFound?.code ?? "") ? "Saved as barcode." : "Saved as SKU."}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotFound(null)}>Cancel</Button>
            <Button disabled={quickAdd.isPending || !quickName.trim()} onClick={() => quickAdd.mutate()}>
              {quickAdd.isPending ? "Adding…" : "Create & add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ReceiptData = {
  id: string;
  items: { name: string; price: number; qty: number }[];
  subtotal: number; discount: number; tax: number; total: number;
  paid: number; change: number; method: string; customer: string;
};

function printThermalReceipt(r: ReceiptData) {
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  const rows = r.items.map((it) => `
    <tr>
      <td class="n">${escapeHtml(it.name)}<div class="m">${it.qty} × ৳${it.price.toFixed(2)}</div></td>
      <td class="a">৳${(it.qty * it.price).toFixed(2)}</td>
    </tr>`).join("");
  const now = new Date();
  const dt = now.toLocaleString();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${r.id}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html,body { margin:0; padding:0; }
    body { font-family: 'Menlo','Consolas',ui-monospace,monospace; color:#000; padding:8px 10px; width:80mm; font-size:12px; }
    .c { text-align:center; }
    .b { font-weight:800; }
    h1 { font-size:16px; margin:0 0 2px; letter-spacing:1px; }
    .muted { color:#333; font-size:11px; }
    hr { border:none; border-top:1px dashed #000; margin:8px 0; }
    table { width:100%; border-collapse:collapse; }
    td { vertical-align:top; padding:2px 0; font-size:12px; }
    td.a { text-align:right; white-space:nowrap; padding-left:6px; }
    .m { color:#444; font-size:10px; }
    .row { display:flex; justify-content:space-between; font-size:12px; padding:1px 0; }
    .total { font-size:15px; font-weight:800; padding:4px 0; border-top:1px dashed #000; border-bottom:1px dashed #000; margin-top:4px; }
    .foot { margin-top:10px; text-align:center; font-size:11px; }
  </style></head><body>
    <div class="c">
      <h1>TOKYOHALAL</h1>
      <div class="muted">POS Sale Receipt</div>
    </div>
    <hr/>
    <div class="row"><span>Date</span><span>${dt}</span></div>
    <div class="row"><span>Sale</span><span>#${r.id.slice(0, 8).toUpperCase()}</span></div>
    <div class="row"><span>Customer</span><span>${escapeHtml(r.customer)}</span></div>
    <div class="row"><span>Payment</span><span>${r.method.toUpperCase()}</span></div>
    <hr/>
    <table>${rows}</table>
    <hr/>
    <div class="row"><span>Subtotal</span><span>৳${r.subtotal.toFixed(2)}</span></div>
    ${r.discount ? `<div class="row"><span>Discount</span><span>− ৳${r.discount.toFixed(2)}</span></div>` : ""}
    ${r.tax ? `<div class="row"><span>Tax</span><span>+ ৳${r.tax.toFixed(2)}</span></div>` : ""}
    <div class="row total"><span>TOTAL</span><span>৳${r.total.toFixed(2)}</span></div>
    <div class="row"><span>Paid</span><span>৳${r.paid.toFixed(2)}</span></div>
    <div class="row"><span>Change</span><span>৳${r.change.toFixed(2)}</span></div>
    <div class="foot">
      Thank you for your purchase!<br/>
      Please come again.
    </div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 300); }, 200);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

