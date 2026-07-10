import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, deleteProduct, listAllVariations } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Search, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products/")({ component: ProductsListPage });

function ProductsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listProducts);
  const varsFn = useServerFn(listAllVariations);
  const deleteFn = useServerFn(deleteProduct);
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: () => listFn() });
  const { data: variations = [] } = useQuery({ queryKey: ["admin-all-variations"], queryFn: () => varsFn() });
  const stockByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of variations as any[]) m.set(v.product_id, (m.get(v.product_id) ?? 0) + Number(v.stock ?? 0));
    return m;
  }, [variations]);
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const withStock = useMemo(() => {
    return (products as any[]).map((p) => ({
      ...p,
      _stock: p.product_type === "variable" ? (stockByProduct.get(p.id) ?? 0) : Number(p.stock ?? 0),
    }));
  }, [products, stockByProduct]);

  const stats = useMemo(() => {
    const total = withStock.length;
    let inStock = 0, low = 0, out = 0;
    for (const p of withStock) {
      const threshold = Number(p.low_stock_alert ?? 5);
      if (p._stock <= 0) out++;
      else if (p._stock <= threshold) low++;
      else inStock++;
    }
    return { total, inStock, low, out };
  }, [withStock]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return withStock.filter((p) => {
      if (s && ![p.name, p.sku, p.barcode, p.category, p.subcategory, p.brand]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s))) return false;
      const threshold = Number(p.low_stock_alert ?? 5);
      if (stockFilter === "in" && !(p._stock > threshold)) return false;
      if (stockFilter === "low" && !(p._stock > 0 && p._stock <= threshold)) return false;
      if (stockFilter === "out" && p._stock > 0) return false;
      return true;
    });
  }, [withStock, q, stockFilter]);

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
        <StatCard label="Total" value={stats.total} icon={Package} tone="muted" active={stockFilter === "all"} onClick={() => setStockFilter("all")} />
        <StatCard label="In stock" value={stats.inStock} icon={CheckCircle2} tone="emerald" active={stockFilter === "in"} onClick={() => setStockFilter("in")} />
        <StatCard label="Low stock" value={stats.low} icon={AlertTriangle} tone="amber" active={stockFilter === "low"} onClick={() => setStockFilter("low")} />
        <StatCard label="Out of stock" value={stats.out} icon={AlertTriangle} tone="rose" active={stockFilter === "out"} onClick={() => setStockFilter("out")} />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, SKU, barcode, category…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 rounded-full" />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const threshold = Number(p.low_stock_alert ?? 5);
                const tone = p._stock <= 0 ? "rose" : p._stock <= threshold ? "amber" : "emerald";
                const toneCls = tone === "emerald"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : tone === "amber"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200";
                return (
                  <tr key={p.id} className="group border-t transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
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
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset tabular-nums ${toneCls}`}>
                        {p._stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
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
      </div>
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
