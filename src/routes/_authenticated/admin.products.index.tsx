import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, deleteProduct, listAllVariations } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Pencil, Plus, Trash2, Search, Package, AlertTriangle, CheckCircle2,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, X,
  TrendingDown, TrendingUp, Minus, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products/")({ component: ProductsListPage });

type SortKey = "name" | "stock" | "price" | "status";
type SortDir = "asc" | "desc";
type StockFilter = "all" | "in" | "low" | "out";
const PAGE_SIZE = 10;

function ProductsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listProducts);
  const varsFn = useServerFn(listAllVariations);
  const deleteFn = useServerFn(deleteProduct);

  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: () => listFn() });
  const { data: variations = [] } = useQuery({ queryKey: ["admin-all-variations"], queryFn: () => varsFn() });

  const stockByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of variations as any[]) m.set(v.product_id, (m.get(v.product_id) ?? 0) + Number(v.stock ?? 0));
    return m;
  }, [variations]);

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Product deleted");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withStock = useMemo(() => {
    return (products as any[]).map((p) => {
      const stock = p.product_type === "variable" ? (stockByProduct.get(p.id) ?? 0) : Number(p.stock ?? 0);
      const threshold = Number(p.low_stock_alert ?? 5);
      const status: "in" | "low" | "out" = stock <= 0 ? "out" : stock <= threshold ? "low" : "in";
      return { ...p, _stock: stock, _threshold: threshold, _status: status };
    });
  }, [products, stockByProduct]);

  const stats = useMemo(() => {
    let inStock = 0, low = 0, out = 0;
    for (const p of withStock) {
      if (p._status === "in") inStock++;
      else if (p._status === "low") low++;
      else out++;
    }
    return { total: withStock.length, inStock, low, out };
  }, [withStock]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of withStock) if (p.category) set.add(p.category);
    return Array.from(set).sort();
  }, [withStock]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = withStock.filter((p) => {
      if (s && ![p.name, p.sku, p.barcode, p.category, p.subcategory, p.brand]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s))) return false;
      if (stockFilter !== "all" && p._status !== stockFilter) return false;
      if (category !== "all" && p.category !== category) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "name": return a.name.localeCompare(b.name) * dir;
        case "stock": return (a._stock - b._stock) * dir;
        case "price": return (Number(a.price) - Number(b.price)) * dir;
        case "status": {
          const order = { out: 0, low: 1, in: 2 } as const;
          return (order[a._status as keyof typeof order] - order[b._status as keyof typeof order]) * dir;
        }
      }
    });
    return list;
  }, [withStock, q, stockFilter, category, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const detail = detailId ? withStock.find((p) => p.id === detailId) : null;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const resetFilters = () => {
    setQ(""); setStockFilter("all"); setCategory("all"); setPage(1);
  };
  const hasFilters = q || stockFilter !== "all" || category !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-sm text-muted-foreground">Manage your catalog, stock, and pricing.</p>
        </div>
        <Button onClick={() => navigate({ to: "/admin/products/new" })} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> New product
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={Package} tone="muted"
          active={stockFilter === "all"} onClick={() => { setStockFilter("all"); setPage(1); }} />
        <StatCard label="In stock" value={stats.inStock} icon={CheckCircle2} tone="emerald"
          active={stockFilter === "in"} onClick={() => { setStockFilter("in"); setPage(1); }} />
        <StatCard label="Low stock" value={stats.low} icon={AlertTriangle} tone="amber"
          active={stockFilter === "low"} onClick={() => { setStockFilter("low"); setPage(1); }} />
        <StatCard label="Out of stock" value={stats.out} icon={AlertTriangle} tone="rose"
          active={stockFilter === "out"} onClick={() => { setStockFilter("out"); setPage(1); }} />
      </div>

      {/* Modern search + filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, barcode, brand…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="h-10 rounded-xl border-0 bg-muted/40 pl-9 pr-9 focus-visible:ring-1"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-[160px] rounded-xl border-0 bg-muted/40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={`${sortKey}:${sortDir}`} onValueChange={(v) => {
          const [k, d] = v.split(":") as [SortKey, SortDir];
          setSortKey(k); setSortDir(d); setPage(1);
        }}>
          <SelectTrigger className="h-10 w-[180px] rounded-xl border-0 bg-muted/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name:asc">Name A → Z</SelectItem>
            <SelectItem value="name:desc">Name Z → A</SelectItem>
            <SelectItem value="stock:asc">Stock: low → high</SelectItem>
            <SelectItem value="stock:desc">Stock: high → low</SelectItem>
            <SelectItem value="price:asc">Price: low → high</SelectItem>
            <SelectItem value="price:desc">Price: high → low</SelectItem>
            <SelectItem value="status:asc">Status: urgent first</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-10 rounded-xl">
            <X className="mr-1 h-4 w-4" /> Reset
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3"><SortHead label="Product" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} /></th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right"><SortHead label="Price" active={sortKey === "price"} dir={sortDir} onClick={() => toggleSort("price")} align="right" /></th>
                <th className="px-4 py-3 text-right"><SortHead label="Stock" active={sortKey === "stock"} dir={sortDir} onClick={() => toggleSort("stock")} align="right" /></th>
                <th className="px-4 py-3"><SortHead label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} /></th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => {
                const isUrgent = p._status !== "in";
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDetailId(p.id)}
                    className={`group cursor-pointer border-t transition hover:bg-muted/30 ${
                      p._status === "out" ? "bg-rose-50/40" : p._status === "low" ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isUrgent && (
                          <span className={`h-8 w-1 shrink-0 rounded-full ${p._status === "out" ? "bg-rose-500" : "bg-amber-500"}`} />
                        )}
                        {p.img ? (
                          <img src={p.img} alt={p.name} className="h-11 w-11 rounded-lg object-cover ring-1 ring-border" />
                        ) : (
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          {p.brand && <div className="truncate text-xs text-muted-foreground">{p.brand}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.category ?? "—"}{p.subcategory ? ` / ${p.subcategory}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">${Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <StockTrend status={p._status} />
                        <span className="tabular-nums font-medium">{p._stock}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p._status} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                        <Link to="/admin/products/$id/edit" params={{ id: p.id }} className="rounded-md p-2 hover:bg-muted">
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Link>
                        <button
                          onClick={() => confirm("Delete this product?") && deleteM.mutate(p.id)}
                          className="rounded-md p-2 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Package className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium">No products found</p>
                    <p className="text-xs text-muted-foreground">Try changing your search or filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(safePage - 1) * PAGE_SIZE + 1}</span>
              –<span className="font-medium text-foreground">{Math.min(safePage * PAGE_SIZE, filtered.length)}</span>
              {" "}of <span className="font-medium text-foreground">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-2 text-xs text-muted-foreground">Page {safePage} / {totalPages}</div>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.name}
                  <StatusBadge status={detail._status} />
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <div className="space-y-2">
                  {detail.img ? (
                    <img src={detail.img} alt={detail.name} className="aspect-square w-full rounded-xl object-cover ring-1 ring-border" />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-xl bg-muted"><Package className="h-8 w-8 text-muted-foreground" /></div>
                  )}
                  {Array.isArray(detail.images) && detail.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {detail.images.slice(0, 4).map((src: string, i: number) => (
                        <img key={i} src={src} alt="" className="aspect-square w-full rounded-md object-cover ring-1 ring-border" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoCell label="Price" value={`$${Number(detail.price).toFixed(2)}`} />
                    <InfoCell label="Stock" value={
                      <span className="inline-flex items-center gap-1.5">
                        <StockTrend status={detail._status} />
                        <span className="tabular-nums font-medium">{detail._stock}</span>
                      </span>
                    } />
                    <InfoCell label="SKU" value={detail.sku ?? "—"} mono />
                    <InfoCell label="Barcode" value={detail.barcode ?? "—"} mono />
                    <InfoCell label="Category" value={detail.category ?? "—"} />
                    <InfoCell label="Brand" value={detail.brand ?? "—"} />
                    <InfoCell label="Type" value={detail.product_type} />
                    <InfoCell label="Low-stock alert" value={String(detail._threshold)} />
                  </div>
                  {detail.description && (
                    <p className="line-clamp-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{detail.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" onClick={() => navigate({ to: "/admin/products/$id/edit", params: { id: detail.id } })}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Link to="/products/$productId" params={{ productId: detail.id }} target="_blank">
                      <Button size="sm" variant="outline"><ExternalLink className="mr-1 h-4 w-4" /> View</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => confirm("Delete this product?") && deleteM.mutate(detail.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortHead({ label, active, dir, onClick, align }: { label: string; active: boolean; dir: SortDir; onClick: () => void; align?: "right" }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}<Icon className="h-3 w-3" />
    </button>
  );
}

function StatusBadge({ status }: { status: "in" | "low" | "out" }) {
  const map = {
    in:  { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "In stock" },
    low: { cls: "bg-amber-50 text-amber-700 ring-amber-200", label: "Low stock" },
    out: { cls: "bg-rose-50 text-rose-700 ring-rose-200", label: "Out of stock" },
  }[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map.cls}`}>{map.label}</span>;
}

function StockTrend({ status }: { status: "in" | "low" | "out" }) {
  if (status === "out") return <TrendingDown className="h-3.5 w-3.5 text-rose-600" />;
  if (status === "low") return <Minus className="h-3.5 w-3.5 text-amber-600" />;
  return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />;
}

function InfoCell({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone, active, onClick,
}: {
  label: string; value: number; icon: any;
  tone: "muted" | "emerald" | "amber" | "rose";
  active: boolean; onClick: () => void;
}) {
  const toneCls = {
    muted: "bg-muted text-foreground",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:shadow-sm ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneCls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </button>
  );
}
