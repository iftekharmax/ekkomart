import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, deleteProduct, listAllVariations } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Pencil, Plus, Trash2, Search, Package, AlertTriangle, CheckCircle2,
  ChevronLeft, ChevronRight, X, TrendingDown, TrendingUp, Minus, Eye,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products/")({ component: ProductsListPage });

type StockStatus = "in" | "low" | "out";
type StockFilter = "all" | StockStatus;
type SortKey = "status" | "price-asc" | "price-desc";
const PAGE_SIZE = 10;
const STATUS_ORDER: Record<StockStatus, number> = { out: 0, low: 1, in: 2 };

function ProductsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listProducts);
  const varsFn = useServerFn(listAllVariations);
  const deleteFn = useServerFn(deleteProduct);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [category, setCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("status");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Debounce search input; searching resets pagination
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 250);
    return () => clearTimeout(t);
  }, [qInput]);

  // Any filter/search/sort change → reset page 1
  useEffect(() => { setPage(1); }, [q, stockFilter, category, sortBy]);

  const { data: products = [], isLoading: pLoading, isFetching: pFetching } = useQuery({
    queryKey: ["admin-products"], queryFn: () => listFn(),
  });
  const { data: variations = [], isLoading: vLoading } = useQuery({
    queryKey: ["admin-all-variations"], queryFn: () => varsFn(),
  });
  const isLoading = pLoading || vLoading;
  const isSearching = qInput !== q || (pFetching && !isLoading);

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
      const status: StockStatus = stock <= 0 ? "out" : stock <= threshold ? "low" : "in";
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
      if (category && p.category !== category) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === "price-asc") return Number(a.price) - Number(b.price);
      if (sortBy === "price-desc") return Number(b.price) - Number(a.price);
      return STATUS_ORDER[a._status as StockStatus] - STATUS_ORDER[b._status as StockStatus];
    });
    return list;
  }, [withStock, q, stockFilter, category, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const detail = detailId ? withStock.find((p) => p.id === detailId) : null;

  const hasFilters = Boolean(q || stockFilter !== "all" || category);
  const clearFilters = () => { setQInput(""); setQ(""); setStockFilter("all"); setCategory(""); };

  const openDetail = (id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    triggerRef.current = e.currentTarget as HTMLElement;
    setDetailId(id);
  };
  const closeDetail = () => {
    setDetailId(null);
    // Return focus to trigger row
    setTimeout(() => triggerRef.current?.focus(), 0);
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold sm:text-2xl">Products</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">Manage your catalog, stock, and pricing.</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => navigate({ to: "/admin/products/new" })}>
          <Plus className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">New product</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Stat filter cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={Package} tone="muted"
          active={stockFilter === "all"} onClick={() => setStockFilter("all")} />
        <StatCard label="In stock" value={stats.inStock} icon={CheckCircle2} tone="emerald"
          active={stockFilter === "in"} onClick={() => setStockFilter("in")} />
        <StatCard label="Low stock" value={stats.low} icon={AlertTriangle} tone="amber"
          active={stockFilter === "low"} onClick={() => setStockFilter("low")} />
        <StatCard label="Out of stock" value={stats.out} icon={AlertTriangle} tone="rose"
          active={stockFilter === "out"} onClick={() => setStockFilter("out")} />
      </div>

      {/* Filters — matches purchases list */}
      <div className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search name, barcode, SKU…"
            className="pl-8 pr-8"
            aria-label="Search products"
          />
          {qInput && (
            <button
              type="button"
              onClick={() => setQInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as StockFilter)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="Filter by stock"
        >
          <option value="all">All stock</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
            aria-label="Sort"
          >
            <option value="status">Sort: urgent first</option>
            <option value="price-asc">Price: low → high</option>
            <option value="price-desc">Price: high → low</option>
          </select>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} title="Clear filters">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Barcode</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 text-right font-semibold">Price</th>
              <th className="px-4 py-3 text-right font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading || isSearching) && Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 animate-pulse rounded-lg bg-muted" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </td>
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-3 w-16 animate-pulse rounded bg-muted" /></td>
                ))}
              </tr>
            ))}

            {!isLoading && !isSearching && pageItems.map((p) => (
              <tr
                key={p.id}
                tabIndex={0}
                role="button"
                aria-label={`View ${p.name}`}
                onClick={(e) => openDetail(p.id, e)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(p.id, e); } }}
                className={`group cursor-pointer border-t align-middle transition hover:bg-muted/30 focus:outline-none focus-visible:bg-muted/40 ${
                  p._status === "out" ? "bg-rose-50/40" : p._status === "low" ? "bg-amber-50/40" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p._status !== "in" && (
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
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.barcode ?? "—"}</td>
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
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={(e) => openDetail(p.id, e)} aria-label="View product">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Link to="/admin/products/$id/edit" params={{ id: p.id }}>
                      <Button size="sm" variant="outline" aria-label="Edit product"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Delete product"
                      onClick={() => { if (confirm("Delete this product?")) deleteM.mutate(p.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {!isLoading && !isSearching && pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Package className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {hasFilters ? "No products match your search" : "No products yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasFilters ? "Try adjusting your search or filters." : "Add your first product to get started."}
                  </p>
                  {hasFilters && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                      <X className="mr-1 h-4 w-4" /> Clear filters
                    </Button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {!isLoading && !isSearching && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(safePage - 1) * PAGE_SIZE + 1}</span>
              –<span className="font-medium text-foreground">{Math.min(safePage * PAGE_SIZE, filtered.length)}</span>
              {" "}of <span className="font-medium text-foreground">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-2 text-xs text-muted-foreground">Page {safePage} / {totalPages}</div>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) closeDetail(); }}>
        <DialogContent
          className="max-w-2xl"
          onEscapeKeyDown={() => closeDetail()}
        >
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.name}
                  <StatusBadge status={detail._status} />
                </DialogTitle>
                <DialogDescription>Product details and quick actions.</DialogDescription>
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
                    <InfoCell label="Barcode" value={detail.barcode ?? "—"} mono />
                    <InfoCell label="SKU" value={detail.sku ?? "—"} mono />
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => { if (confirm("Delete this product?")) deleteM.mutate(detail.id); }}
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

function StatusBadge({ status }: { status: StockStatus }) {
  const map: Record<StockStatus, { cls: string; label: string }> = {
    in:  { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "In stock" },
    low: { cls: "bg-amber-50 text-amber-700 ring-amber-200", label: "Low stock" },
    out: { cls: "bg-rose-50 text-rose-700 ring-rose-200", label: "Out of stock" },
  };
  const m = map[status];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${m.cls}`}>{m.label}</span>;
}

function StockTrend({ status }: { status: StockStatus }) {
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
  const toneCls: Record<"muted" | "emerald" | "amber" | "rose", string> = {
    muted: "bg-muted text-foreground",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition hover:shadow-sm ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneCls[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </button>
  );
}
