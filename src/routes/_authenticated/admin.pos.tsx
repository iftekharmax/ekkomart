import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { posSearchProducts, createPosSale, createPosQuickProduct, listPosTodaySales } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Minus, Plus, Trash2, Search, ScanLine, ShoppingCart, Wallet, X,
  Calculator as CalcIcon, Save, FileText, Delete, Maximize2, Minimize2, History,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pos")({
  head: () => ({ meta: [{ title: "POS — Tokyohalal" }] }),
  component: PosPage,
});

type Product = {
  id: string; name: string; sku: string | null; barcode: string | null;
  price: number; stock: number | null; img: string | null; unit: string | null;
  product_id?: string; variation_id?: string | null;
  parent_name?: string | null; variation_name?: string | null;
};
type CartItem = Product & { qty: number };



const money = (n: number) => `৳${n.toFixed(2)}`;
const itemParentLabel = (item: Pick<Product, "name" | "parent_name" | "variation_id">) => (
  item.variation_id ? (item.parent_name || item.name.split(" - ")[0] || item.name) : item.name
);
const itemVariationLabel = (item: Pick<Product, "name" | "parent_name" | "variation_id" | "variation_name">) => {
  if (!item.variation_id) return null;
  if (item.variation_name) return item.variation_name;
  const parent = itemParentLabel(item);
  return item.name.startsWith(`${parent} - `) ? item.name.slice(parent.length + 3) : item.name;
};
const itemFullLabel = (item: Pick<Product, "name" | "parent_name" | "variation_id" | "variation_name">) => {
  const variation = itemVariationLabel(item);
  return variation ? `${itemParentLabel(item)} - ${variation}` : item.name;
};
const textOrDash = (value: unknown) => {
  if (value == null) return "—";
  const text = String(value).trim();
  return text.length > 0 ? text : "—";
};
const stockInfo = (stock: unknown, unit: unknown) => {
  if (stock == null || String(stock).trim() === "") return { label: "Stock: N/A", tone: "text-slate-500", out: false };
  const qty = Number(stock);
  const unitText = textOrDash(unit) === "—" ? "pcs" : textOrDash(unit);
  if (!Number.isFinite(qty)) return { label: "Stock: N/A", tone: "text-slate-500", out: false };
  if (qty <= 0) return { label: "Out of stock", tone: "text-rose-600", out: true };
  return { label: `Stock: ${qty} ${unitText}`, tone: "text-emerald-600", out: false };
};

function PosPage() {
  const searchFn = useServerFn(posSearchProducts);
  const saleFn = useServerFn(createPosSale);
  const quickAddFn = useServerFn(createPosQuickProduct);
  const historyFn = useServerFn(listPosTodaySales);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const historyQ = useQuery({
    queryKey: ["pos-today-sales"],
    queryFn: () => historyFn({}) as Promise<{ rows: { id: string; total: number; created_at: string; payment_method: string; customer: string | null; items: { name: string; qty: number; price: number }[]; quantity: number }[]; total: number; count: number }>,
    enabled: historyOpen,
  });
  useEffect(() => {
    if (historyQ.isError) toast.error("Couldn’t load today’s sales. Please try again.");
  }, [historyQ.isError]);
  const filteredHistoryRows = useMemo(() => {
    const rows = historyQ.data?.rows ?? [];
    const q = historySearch.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => (r.customer ?? "").toLowerCase().includes(q)) : rows.slice();
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [historyQ.data, historySearch]);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 150); return () => clearTimeout(t); }, [q]);

  const { data: suggestions = [], isFetching, isError: suggestionsError, error: suggestionsErrorDetails, refetch: retrySuggestions } = useQuery({
    queryKey: ["pos-suggest", debouncedQ],
    queryFn: () => searchFn({ data: { q: debouncedQ, limit: 8 } }) as Promise<Product[]>,
    enabled: debouncedQ.trim().length > 0,
    retry: false,
  });
  useEffect(() => {
    if (suggestionsError) toast.error("Product search failed", { description: (suggestionsErrorDetails as Error)?.message ?? "Try again." });
  }, [suggestionsError, suggestionsErrorDetails]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxMode, setTaxMode] = useState<"default" | "free">("default");
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");
  const [customer, setCustomer] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>(() => loadDrafts());
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<null | { code: string }>(null);
  const [quickName, setQuickName] = useState("");
  const [quickPrice, setQuickPrice] = useState<number>(0);
  const [quickStock, setQuickStock] = useState<number>(1);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const bufferRef = useRef<string>("");
  const hydratedRef = useRef(false);
  const saveDraftRef = useRef<() => void>(() => {});

  // Restore auto-saved cart once on mount
  useEffect(() => {
    const auto = loadAutosave();
    if (auto && auto.cart.length > 0) {
      setCart(auto.cart.map((c) => ({ ...c, price: Number(c.price), qty: Number(c.qty) })));
      setCustomer(auto.customer ?? "");
      setDiscount(Number(auto.discount) || 0);
      setTaxMode(auto.taxMode ?? "default");
      setMethod(auto.method ?? "cash");
    }
    hydratedRef.current = true;
    searchRef.current?.focus();
  }, []);

  // Debounced auto-save with versioned snapshot (last writer with newer version wins)
  const autosaveVersionRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      if (cart.length === 0) { clearAutosave(); return; }
      const version = ++autosaveVersionRef.current;
      const existing = loadAutosave();
      if (existing && (existing.version ?? 0) > version) return; // don't overwrite newer
      persistAutosave({ cart, customer, discount, taxMode, method, version, at: Date.now() });
    }, 800);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [cart, customer, discount, taxMode, method]);

  const subtotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);
  const TAX_RATE = 0.08;
  const tax = taxMode === "default" ? Math.round((subtotal - discount) * TAX_RATE * 100) / 100 : 0;
  const total = Math.max(0, subtotal - discount + tax);
  const change = Math.max(0, paid - total);

  function addToCart(p: Product) {
    let ok = true;
    const label = itemFullLabel(p);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const next = copy[idx].qty + 1;
        if (p.stock != null && next > p.stock) {
          toast.error(`Insufficient stock for “${label}”`, { description: `Only ${p.stock} available` });
          ok = false; return prev;
        }
        copy[idx] = { ...copy[idx], qty: next };
        return copy;
      }
      if (p.stock != null && p.stock <= 0) {
        toast.error(`“${label}” is out of stock`);
        ok = false; return prev;
      }
      return [...prev, { ...p, qty: 1 }];
    });
    if (ok) {
      toast.success(`Added: ${label}`, { duration: 1200 });
    }
  }

  function setQty(id: string, qty: number) {
    setCart((prev) => prev.flatMap((it) => {
      if (it.id !== id) return [it];
      if (qty <= 0) return [];
      if (it.stock != null && qty > it.stock) {
        toast.error(`Insufficient stock for “${itemFullLabel(it)}”`, { description: `Only ${it.stock} available` });
        return [it];
      }
      return [{ ...it, qty }];
    }));
  }

  function remove(id: string) { setCart((prev) => prev.filter((i) => i.id !== id)); }
  function clearAll() { setCart([]); setDiscount(0); setTaxMode("default"); setPaid(0); setCustomer(""); }

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
      // Global shortcut: Ctrl/Cmd+D save current cart as draft
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        saveDraftRef.current?.();
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
      const items = cart.map((c) => ({
        product_id: String(c.product_id ?? c.id),
        variation_id: c.variation_id ?? null,
        name: itemFullLabel(c),
        parent_name: c.parent_name ?? null,
        variation_name: c.variation_name ?? null,
        price: Number(c.price) || 0,
        qty: Math.floor(Number(c.qty) || 0),
        img: c.img ?? null,
      }));
      const invalid = items.find((it) => it.qty < 1);
      if (invalid) throw new Error(`Invalid quantity for ${invalid.name}`);

      const snapshot = {
        items: items.map((i) => ({ name: i.name, parent_name: i.parent_name, variation_name: i.variation_name, price: i.price, qty: i.qty })),
        subtotal, discount: Number(discount) || 0, tax: Number(tax) || 0, total,
        paid: Number(paid) || 0, change, method, customer: customer || "Walk-in",
      };
      const res = await saleFn({ data: {
        items, discount: Number(discount) || 0, tax: Number(tax) || 0,
        paid: Number(paid) || 0, payment_method: method, customer: customer || null,
      } });
      return { res: res as { id: string; total: number }, snapshot };
    },
    onSuccess: ({ res, snapshot }) => {
      printThermalReceipt({ id: res.id, ...snapshot });
      clearAll();
      clearAutosave();
      toast.success(`Payment successful · ${money(res.total)}`, {
        description: `Invoice #${res.id.slice(0, 8).toUpperCase()} — printing receipt`,
      });
    },
    onError: (e: Error) => {
      toast.error("Payment failed — cart restored", {
        description: e.message || "Stock was not changed. Fix the cart and retry.",
      });
    },
  });

  function saveDraft() {
    if (cart.length === 0) { toast.error("Cart is empty — nothing to draft"); return; }
    const first = cart[0];
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const extra = cart.length > 1 ? ` +${cart.length - 1}` : "";
    const name = `${first.name}${extra} · ${money(Number(first.price))} · ${time}`;
    const d: Draft = { id: crypto.randomUUID(), at: Date.now(), name, cart, customer, discount, taxMode, method };
    const next = [d, ...drafts].slice(0, 20);
    setDrafts(next); persistDrafts(next);
    clearAll();
    clearAutosave();
    toast.success(`Draft saved: ${name}`);
  }
  function loadDraft(id: string) {
    const d = drafts.find((x) => x.id === id); if (!d) return;
    setCart(d.cart.map((c) => ({ ...c, price: Number(c.price), qty: Number(c.qty) })));
    setCustomer(d.customer); setDiscount(Number(d.discount) || 0); setTaxMode(d.taxMode ?? "default"); setMethod(d.method);
    setPaid(0);
    const next = drafts.filter((x) => x.id !== id);
    setDrafts(next); persistDrafts(next);
    setDraftsOpen(false);
    toast.success(`Loaded draft: ${d.name ?? d.customer}`);
  }
  function removeDraft(id: string) {
    const d = drafts.find((x) => x.id === id);
    const next = drafts.filter((x) => x.id !== id);
    setDrafts(next); persistDrafts(next);
    toast.success(`Deleted draft${d?.name ? `: ${d.name}` : ""}`);
  }
  saveDraftRef.current = saveDraft;



  const [posRootEl, setPosRootEl] = useState<HTMLDivElement | null>(null);
  const posRootRef = useCallback((el: HTMLDivElement | null) => setPosRootEl(el), []);
  const fsBusyRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      fsBusyRef.current = false;
    };
    const onError = () => {
      fsBusyRef.current = false;
      toast.error("Fullscreen failed. Your browser may block it here.");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("fullscreenerror", onError);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("fullscreenerror", onError);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const toggleFullscreen = async () => {
    if (fsBusyRef.current) return;
    const el = posRootEl;
    if (!el) return;
    if (typeof el.requestFullscreen !== "function" || typeof document.exitFullscreen !== "function") {
      toast.message("Fullscreen isn’t supported in this browser.");
      return;
    }
    fsBusyRef.current = true;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        toast.success("Entered fullscreen. Press Esc to exit.");
      } else {
        await document.exitFullscreen();
        toast.message("Exited fullscreen.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn’t toggle fullscreen.");
      fsBusyRef.current = false;
    }
  };
  // While in fullscreen on the POS container, portals (Select, etc.) must render
  // inside it or they end up hidden outside the fullscreen element.
  const portalContainer = isFullscreen ? posRootEl : undefined;

  return (
    <div ref={posRootRef} className="-m-4 grid gap-5 bg-gradient-to-br from-slate-100 via-slate-50 to-white p-4 antialiased dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:-m-6 sm:p-6 lg:-m-8 lg:h-[calc(100dvh-2rem)] lg:grid-cols-[minmax(0,1fr)_440px] lg:overflow-hidden lg:p-6">
      {/* LEFT: Scan/Search + Cart items summary */}
      <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        {/* Scanner header */}
        <div className="border-b border-slate-200/70 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-6 dark:border-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
              <ScanLine className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/70">Point of Sale</div>
              <div className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">Scan or search a product</div>
            </div>
            {isFullscreen && (
              <span
                role="status"
                aria-live="polite"
                className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 sm:inline-flex"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Fullscreen
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen (Escape)" : "Enter fullscreen"}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
              className="h-9 rounded-xl border-slate-200 bg-white/80 font-medium shadow-sm hover:bg-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900/60"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
              <span className="ml-1.5 hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
            </Button>
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
              className="h-14 rounded-2xl border-2 border-primary/15 bg-white pl-12 pr-4 text-[15px] font-medium tracking-tight shadow-sm placeholder:font-normal placeholder:text-slate-400 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 dark:bg-slate-950"
            />
            {open && q.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {suggestionsError ? (
                  <div className="flex items-center justify-between gap-3 p-4 text-sm text-rose-600">
                    <span>Search failed. Please retry.</span>
                    <Button size="sm" variant="outline" type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => retrySuggestions()}>
                      Retry
                    </Button>
                  </div>
                ) : isFetching && suggestions.length === 0 ? (
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
                      const stock = stockInfo(p.stock, p.unit);
                      const out = stock.out;
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
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {p.variation_id ? (p.parent_name ?? p.name) : p.name}
                                </div>
                                {p.variation_id && p.variation_name ? (
                                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                    {p.variation_name}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[11px] leading-tight text-slate-500">
                                <span className="min-w-0 truncate">Barcode: {textOrDash(p.barcode)}</span>
                                <span className="shrink-0 text-slate-300">·</span>
                                <span className={`shrink-0 font-semibold ${stock.tone}`}>{stock.label}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-primary">{money(Number(p.price))}</div>
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Cart</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">{cart.length}</span>
            </div>
            {cart.length > 0 && (
              <button onClick={clearAll} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                <X className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="grid h-full place-items-center py-16 text-center text-sm text-slate-500">
                <div>
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <ScanLine className="h-8 w-8 text-slate-400" />
                  </div>
                  <div className="text-base font-semibold text-slate-700 dark:text-slate-200">Ready to scan</div>
                  <div className="mt-1 text-xs text-slate-500">Scan a barcode or search above to add items.</div>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((it) => (
                  <li key={it.id} onClick={() => setSelectedCartId(it.id)} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all ${selectedCartId === it.id ? "border-primary bg-primary/[0.06] shadow-md shadow-primary/10 ring-1 ring-primary/30" : "border-slate-200/80 bg-white hover:border-primary/40 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{itemParentLabel(it)}</div>
                        {itemVariationLabel(it) ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {itemVariationLabel(it)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs tabular-nums text-slate-500">{money(Number(it.price))} × {it.qty} = <b className="text-slate-800 dark:text-slate-100">{money(Number(it.price) * it.qty)}</b></div>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-slate-100/70 p-0.5 dark:bg-slate-800/60">
                      <button onClick={(e) => { e.stopPropagation(); setQty(it.id, it.qty - 1); }} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"><Minus className="h-3.5 w-3.5" /></button>
                      <input
                        value={it.qty}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setQty(it.id, Math.max(0, Number(e.target.value) || 0))}
                        className="h-7 w-10 rounded-md bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
                      />
                      <button onClick={(e) => { e.stopPropagation(); setQty(it.id, it.qty + 1); }} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-700"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); remove(it.id); }} className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT: Checkout */}
      <aside className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <header className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/25">
              <Wallet className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">Checkout</div>
              <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">Review & complete sale</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={saveDraft} className="h-8 gap-1 rounded-lg border-slate-200 bg-white/70 px-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-900/50" title="Save current cart as draft">
              <Save className="h-3.5 w-3.5" /> Draft
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setDraftsOpen(true)} className="h-8 gap-1 rounded-lg border-slate-200 bg-white/70 px-2 text-xs font-medium tabular-nums dark:border-slate-700 dark:bg-slate-900/50" title="Open saved drafts">
              <FileText className="h-3.5 w-3.5" /> {drafts.length}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="h-8 gap-1 rounded-lg border-slate-200 bg-white/70 px-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-900/50" title="Today's sales history">
              <History className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCalcOpen(true)} className="h-8 gap-1 rounded-lg border-slate-200 bg-white/70 px-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-900/50" title="Calculator">
              <CalcIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>


        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mobile number
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" className="mt-1.5 h-10 rounded-lg border-slate-200 text-sm font-medium tracking-tight dark:border-slate-700" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Method
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger className="mt-1.5 h-10 rounded-lg border-slate-200 text-sm font-medium dark:border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent container={portalContainer}>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Discount
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="mt-1.5 h-10 rounded-lg border-slate-200 text-sm font-semibold tabular-nums dark:border-slate-700" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tax
              <Select value={taxMode} onValueChange={(v) => setTaxMode(v as "default" | "free")}>
                <SelectTrigger className="mt-1.5 h-10 rounded-lg border-slate-200 text-sm font-medium dark:border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent container={portalContainer}>
                  <SelectItem value="default">Default (8%)</SelectItem>
                  <SelectItem value="free">Tax free</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50 to-white p-4 text-sm tabular-nums dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
            <Row label={<span className="text-slate-500">Subtotal</span>} value={<span className="font-medium text-slate-700 dark:text-slate-200">{money(subtotal)}</span>} />
            <Row label={<span className="text-slate-500">Discount</span>} value={<span className="font-medium text-rose-600">− {money(discount)}</span>} />
            <Row label={<span className="text-slate-500">{taxMode === "default" ? "Tax (8%)" : "Tax (free)"}</span>} value={<span className="font-medium text-slate-700 dark:text-slate-200">+ {money(tax)}</span>} />
            <div className="my-2 border-t border-dashed border-slate-200 dark:border-slate-800" />
            <Row label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total due</span>} value={<span className="text-2xl font-bold tracking-tight text-primary">{money(total)}</span>} />
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount received</label>
            <div className="mt-1.5 flex gap-2">
              <Input
                type="number" min={0} value={paid}
                onChange={(e) => setPaid(Math.max(0, Number(e.target.value) || 0))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (cart.length > 0 && paid >= total && !sale.isPending) sale.mutate();
                  }
                }}
                className="h-11 flex-1 rounded-lg border-slate-200 text-base font-semibold tabular-nums dark:border-slate-700"
              />
              <Button type="button" variant="outline" className="h-11 rounded-lg border-slate-200 px-4 font-semibold dark:border-slate-700" onClick={() => setPaid(total)}>Exact</Button>
            </div>
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold tabular-nums ${paid >= total ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
              {paid >= total ? `Change to return: ${money(change)}` : `Remaining: ${money(total - paid)}`}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
          <Button
            onClick={() => sale.mutate()}
            disabled={sale.isPending || cart.length === 0 || paid < total}
            className="h-14 w-full rounded-xl bg-gradient-to-r from-primary to-primary/85 text-base font-semibold tracking-tight shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/30 disabled:opacity-60 disabled:shadow-none"
          >
            <Wallet className="mr-2 h-5 w-5" />
            {sale.isPending ? "Processing…" : `Pay · ${money(total)}`}
          </Button>
        </div>
      </aside>

      <DraftsDialog open={draftsOpen} onOpenChange={setDraftsOpen} drafts={drafts} onLoad={loadDraft} onRemove={removeDraft} container={portalContainer} />
      <CalculatorDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        selectedItem={cart.find((c) => c.id === selectedCartId) ?? null}
        onApplyQty={(n) => {
          if (!selectedCartId) return;
          setQty(selectedCartId, Math.max(1, Math.floor(n)));
          toast.success(`Qty set to ${Math.max(1, Math.floor(n))}`);
        }}
        onApplyDiscount={(n) => { setDiscount(Math.max(0, n)); toast.success(`Discount set to ${money(Math.max(0, n))}`); }}
        container={portalContainer}
      />


      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent container={portalContainer} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-slate-200/70 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent px-5 py-4 dark:border-slate-800">
            <DialogTitle className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/25">
                <History className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">Sales report</span>
                <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">Today’s sales</span>
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setHistorySearch(""); }}
                placeholder="Search by customer…"
                aria-label="Search today's sales by customer"
                className="h-11 rounded-xl border-slate-200 pl-9 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/15 dark:border-slate-700"
              />
            </div>

            {historyQ.isLoading ? (
              <div className="space-y-2" aria-busy="true" aria-live="polite">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-slate-900" />
                    </div>
                    <div className="h-5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : historyQ.isError ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 py-8 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
                <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">Couldn’t load sales</div>
                <div className="text-xs text-rose-600/80 dark:text-rose-400/80">Check your connection and try again.</div>
                <Button size="sm" variant="outline" onClick={() => historyQ.refetch()} className="mt-1">Retry</Button>
              </div>
            ) : filteredHistoryRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <History className="h-6 w-6 text-slate-400" aria-hidden="true" />
                </div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {(historyQ.data?.rows ?? []).length === 0 ? "No sales yet today" : "No matching customers"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(historyQ.data?.rows ?? []).length === 0 ? "Completed sales will appear here." : "Try a different search."}
                </div>
              </div>
            ) : (
              <div className="max-h-[46vh] overflow-auto rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-950">
                <table className="w-full text-xs tabular-nums">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur dark:bg-slate-900/95">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 text-left">Time</th>
                      <th scope="col" className="px-3 py-2.5 text-left">Customer</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Items</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Qty</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryRows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 transition hover:bg-primary/[0.03] dark:border-slate-800/70">
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-600 dark:text-slate-300">
                          {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 dark:text-slate-100">{r.customer || <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex min-w-[1.75rem] justify-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{r.items.length}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200">{r.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-primary">{money(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sales</span>
                <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{historyQ.data?.count ?? 0}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total revenue</span>
                <span className="text-2xl font-bold tracking-tight tabular-nums text-primary">{money(historyQ.data?.total ?? 0)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <Button variant="outline" onClick={() => historyQ.refetch()} disabled={historyQ.isFetching} className="rounded-lg">
              {historyQ.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            <Button onClick={() => setHistoryOpen(false)} className="rounded-lg">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!notFound} onOpenChange={(o) => !o && setNotFound(null)}>
        <DialogContent container={portalContainer} className="sm:max-w-md">
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

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
      <span>{label}</span><span>{value}</span>
    </div>
  );
}


type ReceiptData = {
  id: string;
  items: { name: string; parent_name?: string | null; variation_name?: string | null; price: number; qty: number }[];
  subtotal: number; discount: number; tax: number; total: number;
  paid: number; change: number; method: string; customer: string;
};

function printThermalReceipt(r: ReceiptData) {
  const win = window.open("", "_blank", "width=380,height=720");
  if (!win) return;
  const rows = r.items.map((it, i) => {
    const title = it.parent_name && it.variation_name ? it.parent_name : it.name;
    const variation = it.parent_name && it.variation_name ? `<div class="v">${escapeHtml(it.variation_name)}</div>` : "";
    return `
    <tr class="it">
      <td class="idx">${i + 1}</td>
      <td class="n"><div class="nm">${escapeHtml(title)}</div>${variation}<div class="m">${it.qty} × ৳${it.price.toFixed(2)}</div></td>
      <td class="a">৳${(it.qty * it.price).toFixed(2)}</td>
    </tr>`;
  }).join("");
  const now = new Date();
  const dt = now.toLocaleString();
  const itemsCount = r.items.reduce((s, it) => s + it.qty, 0);
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${r.id}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html,body { margin:0; padding:0; background:#fff; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#000; padding:10px 10px 14px; width:80mm; font-size:12px; -webkit-font-smoothing:antialiased; }
    .c { text-align:center; }
    h1 { font-size:20px; margin:0; letter-spacing:3px; font-weight:900; }
    .tag { display:inline-block; margin-top:4px; padding:2px 8px; border:1px solid #000; border-radius:999px; font-size:9px; letter-spacing:2px; font-weight:700; text-transform:uppercase; }
    .addr { margin-top:4px; font-size:10px; color:#222; line-height:1.35; }
    .divider { border:none; border-top:1px dashed #000; margin:8px 0; }
    .solid { border:none; border-top:1.5px solid #000; margin:8px 0; }
    .meta { display:grid; grid-template-columns:auto 1fr; gap:2px 8px; font-size:11px; }
    .meta b { font-weight:700; }
    table { width:100%; border-collapse:collapse; }
    thead th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding:4px 0; border-bottom:1px solid #000; }
    thead th.a { text-align:right; }
    td { vertical-align:top; padding:5px 0; font-size:12px; }
    td.idx { width:16px; color:#555; font-size:10px; }
    td.a { text-align:right; white-space:nowrap; padding-left:6px; font-weight:700; }
    .nm { font-weight:700; line-height:1.25; }
    .v { display:inline-block; margin-top:2px; border:1px solid #000; border-radius:999px; padding:1px 6px; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; }
    .m { color:#444; font-size:10px; margin-top:1px; }
    .row { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; }
    .row.strong { font-weight:700; }
    .total-box { margin-top:6px; padding:8px 6px; background:#000; color:#fff; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-weight:900; }
    .total-box .lbl { font-size:11px; letter-spacing:2px; }
    .total-box .val { font-size:18px; }
    .pay { margin-top:6px; padding:6px 0; border-top:1px dashed #000; border-bottom:1px dashed #000; }
    .foot { margin-top:12px; text-align:center; font-size:11px; }
    .foot .thanks { font-weight:800; font-size:13px; letter-spacing:1px; }
    .foot .sub { color:#333; margin-top:2px; }
    .barcode { margin-top:10px; text-align:center; font-family: 'Libre Barcode 39', 'Courier New', monospace; font-size:28px; letter-spacing:2px; }
    .id { font-family: 'Courier New', monospace; font-size:10px; text-align:center; margin-top:2px; color:#333; }
  </style></head><body>
    <div class="c">
      <h1>TOKYOHALAL</h1>
      <div class="tag">Official Sale Receipt</div>
      <div class="addr">Halal Food & Grocery<br/>Dhaka, Bangladesh</div>
    </div>
    <hr class="solid"/>
    <div class="meta">
      <b>Date</b><span>${dt}</span>
      <b>Invoice</b><span>#${r.id.slice(0, 8).toUpperCase()}</span>
      <b>Customer</b><span>${escapeHtml(r.customer)}</span>
      <b>Payment</b><span>${r.method.toUpperCase()}</span>
    </div>
    <hr class="divider"/>
    <table>
      <thead><tr><th>#</th><th>Item</th><th class="a">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="divider"/>
    <div class="row"><span>Items</span><span>${itemsCount}</span></div>
    <div class="row"><span>Subtotal</span><span>৳${r.subtotal.toFixed(2)}</span></div>
    ${r.discount ? `<div class="row"><span>Discount</span><span>− ৳${r.discount.toFixed(2)}</span></div>` : ""}
    ${r.tax ? `<div class="row"><span>Tax</span><span>+ ৳${r.tax.toFixed(2)}</span></div>` : ""}
    <div class="total-box"><span class="lbl">TOTAL</span><span class="val">৳${r.total.toFixed(2)}</span></div>
    <div class="pay">
      <div class="row strong"><span>Paid (${r.method})</span><span>৳${r.paid.toFixed(2)}</span></div>
      <div class="row strong"><span>Change</span><span>৳${r.change.toFixed(2)}</span></div>
    </div>
    <div class="foot">
      <div class="thanks">Thank you for shopping!</div>
      <div class="sub">Please keep the receipt for exchange or return.</div>
      <div class="id">${r.id}</div>
    </div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 300); }, 250);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ============ Drafts (localStorage) ============
type Draft = {
  id: string; at: number; name?: string; cart: CartItem[]; customer: string;
  discount: number; taxMode: "default" | "free"; method: "cash" | "card" | "mobile" | "other";
};
const DRAFTS_KEY = "pos.drafts.v1";
const AUTOSAVE_KEY = "pos.autosave.v1";
function loadDrafts(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]") as any[];
    return raw.map((d) => ({ ...d, taxMode: d.taxMode ?? (Number(d.tax) > 0 ? "default" : "free") }));
  } catch { return []; }
}
function persistDrafts(d: Draft[]) {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
type AutosaveShape = Omit<Draft, "id" | "at" | "name"> & { version?: number; at?: number };
function loadAutosave(): AutosaveShape | null {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(AUTOSAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function persistAutosave(d: AutosaveShape) {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
function clearAutosave() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}

function DraftsDialog({ open, onOpenChange, drafts, onLoad, onRemove, container }: {
  open: boolean; onOpenChange: (o: boolean) => void; drafts: Draft[];
  onLoad: (id: string) => void; onRemove: (id: string) => void;
  container?: HTMLElement | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent container={container ?? undefined} className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Saved drafts</DialogTitle></DialogHeader>
        {drafts.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No drafts saved yet.</div>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {drafts.map((d) => {
              const subtotal = d.cart.reduce((s, it) => s + it.price * it.qty, 0);
              const tax = d.taxMode === "default" ? Math.round((subtotal - d.discount) * 0.08 * 100) / 100 : 0;
              const total = Math.max(0, subtotal - d.discount + tax);
              const itemsCount = d.cart.reduce((s, it) => s + it.qty, 0);
              const dt = new Date(d.at);
              return (
                <li key={d.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">📱 {d.customer || "Walk-in"}</div>
                    <div className="text-[11px] text-slate-500">{itemsCount} items · {money(total)}</div>
                    <div className="text-[11px] text-slate-400">{dt.toLocaleDateString()} · {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <Button size="sm" onClick={() => onLoad(d.id)}>Load</Button>
                  <Button size="sm" variant="outline" title="Delete draft" onClick={() => onRemove(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ Calculator ============
function CalculatorDialog({ open, onOpenChange, selectedItem, onApplyQty, onApplyDiscount, container }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  selectedItem: CartItem | null;
  onApplyQty: (n: number) => void;
  onApplyDiscount: (n: number) => void;
  container?: HTMLElement | null;
}) {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("0");

  function push(v: string) { setExpr((e) => (e + v).slice(0, 40)); }
  function clr() { setExpr(""); setResult("0"); }
  function back() { setExpr((e) => e.slice(0, -1)); }
  function evaluate() {
    try {
      const clean = expr.replace(/[^0-9+\-*/.() %]/g, "").replace(/×/g, "*").replace(/÷/g, "/");
      if (!clean) return;
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${clean})`)();
      const n = Number(val);
      if (!Number.isFinite(n)) { setResult("Error"); return; }
      setResult(String(Math.round(n * 100) / 100));
      setExpr(String(n));
    } catch { setResult("Error"); }
  }

  const keys: Array<{ k: string; label?: React.ReactNode; cls?: string; on: () => void }> = [
    { k: "C", on: clr, cls: "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/50 dark:text-rose-300" },
    { k: "(", on: () => push("(") },
    { k: ")", on: () => push(")") },
    { k: "÷", on: () => push("/"), cls: "bg-primary/10 text-primary" },
    { k: "7", on: () => push("7") }, { k: "8", on: () => push("8") }, { k: "9", on: () => push("9") },
    { k: "×", on: () => push("*"), cls: "bg-primary/10 text-primary" },
    { k: "4", on: () => push("4") }, { k: "5", on: () => push("5") }, { k: "6", on: () => push("6") },
    { k: "−", on: () => push("-"), cls: "bg-primary/10 text-primary" },
    { k: "1", on: () => push("1") }, { k: "2", on: () => push("2") }, { k: "3", on: () => push("3") },
    { k: "+", on: () => push("+"), cls: "bg-primary/10 text-primary" },
    { k: "0", on: () => push("0") }, { k: ".", on: () => push(".") },
    { k: "⌫", label: <Delete className="h-4 w-4" />, on: back },
    { k: "=", on: evaluate, cls: "bg-primary text-primary-foreground hover:bg-primary/90" },
  ];

  const resultNum = Number(result);
  const canApply = Number.isFinite(resultNum) && result !== "Error";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent container={container ?? undefined} className="sm:max-w-xs">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalcIcon className="h-5 w-5 text-primary" /> Calculator</DialogTitle></DialogHeader>
        <div className="rounded-xl bg-slate-900 p-4 text-right text-white shadow-inner">
          <div className="min-h-[18px] truncate text-xs text-slate-400">{expr || "\u00A0"}</div>
          <div className="truncate text-3xl font-bold tabular-nums">{result}</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {keys.map((b) => (
            <button
              key={b.k}
              onClick={b.on}
              className={`h-12 rounded-lg text-base font-semibold transition ${b.cls ?? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
            >
              {b.label ?? b.k}
            </button>
          ))}
        </div>
        <div className="mt-1 rounded-lg border border-dashed border-slate-200 p-2 dark:border-slate-700">
          <div className="mb-2 text-[11px] text-slate-500">
            {selectedItem
              ? <>Apply <b className="tabular-nums">{result}</b> to <b className="truncate">{selectedItem.name}</b></>
              : <>Select a cart item to apply as quantity, or apply as discount.</>}
          </div>
          {canApply && selectedItem && (
            <div className="mb-2 rounded-md bg-primary/5 p-2 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex justify-between"><span>Current</span><span className="tabular-nums">{selectedItem.qty} × {money(Number(selectedItem.price))} = <b>{money(selectedItem.qty * Number(selectedItem.price))}</b></span></div>
              <div className="flex justify-between text-primary"><span>After apply qty</span><span className="tabular-nums">{Math.max(1, Math.floor(resultNum))} × {money(Number(selectedItem.price))} = <b>{money(Math.max(1, Math.floor(resultNum)) * Number(selectedItem.price))}</b></span></div>
            </div>
          )}
          {canApply && (
            <div className="mb-2 rounded-md bg-slate-100 p-2 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <div className="flex justify-between"><span>If set as discount</span><span className="tabular-nums">− {money(Math.max(0, resultNum))}</span></div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline" className="flex-1"
              disabled={!canApply || !selectedItem}
              onClick={() => { onApplyQty(resultNum); onOpenChange(false); }}
            >Set Qty</Button>
            <Button
              size="sm" className="flex-1"
              disabled={!canApply}
              onClick={() => { onApplyDiscount(resultNum); onOpenChange(false); }}
            >Set Discount</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


