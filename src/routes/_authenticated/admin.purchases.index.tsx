import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPurchases, deletePurchase } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Eye, Search, X, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/purchases/")({
  head: () => ({ meta: [{ title: "Purchases — Admin" }] }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listPurchases);
  const delFn = useServerFn(deletePurchase);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-purchases"], queryFn: () => listFn() });

  const [q, setQ] = useState("");
  const [supplier, setSupplier] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const suppliers = useMemo(() => {
    const s = new Set<string>();
    (rows as any[]).forEach((p) => { if (p.supplier?.name) s.add(p.supplier.name); });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (rows as any[]).filter((p) => {
      if (qq && !String(p.reference ?? "").toLowerCase().includes(qq)) return false;
      if (supplier && (p.supplier?.name ?? "") !== supplier) return false;
      if (dateFrom && String(p.purchase_date) < dateFrom) return false;
      if (dateTo && String(p.purchase_date) > dateTo) return false;
      return true;
    });
  }, [rows, q, supplier, dateFrom, dateTo]);

  const hasFilters = Boolean(q || supplier || dateFrom || dateTo);
  const clearFilters = () => { setQ(""); setSupplier(""); setDateFrom(""); setDateTo(""); };

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Purchase deleted (stock reversed)");
      qc.invalidateQueries({ queryKey: ["admin-purchases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold sm:text-2xl">Purchases</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">Record supplier purchases — stock updates automatically.</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => navigate({ to: "/admin/purchases/new" })}>
          <Plus className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">New purchase</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Invoice no." className="pl-8" />
        </div>
        <select
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
        <div className="flex gap-2">
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" className="flex-1" />
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} title="Clear filters">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/40" />
          ))
        ) : (rows as any[]).length === 0 ? (
          <EmptyState onNew={() => navigate({ to: "/admin/purchases/new" })} />
        ) : filtered.length === 0 ? (
          <NoResults onClear={clearFilters} />
        ) : filtered.map((p) => {
          const due = Math.max(0, Number(p.total) - Number(p.paid ?? 0));
          const items = (p.items ?? []) as any[];
          const totalQty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
          return (
            <div key={p.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{p.reference}</div>
                  <div className="truncate text-sm font-semibold">{p.supplier?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.purchase_date}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link to="/admin/purchases/$id" params={{ id: p.id }}>
                    <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (confirm("Delete purchase? Stock will be decreased.")) del.mutate(p.id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {items.length > 0 && (
                <ul className="mt-2 space-y-0.5 border-t pt-2">
                  {items.map((it) => (
                    <li key={it.id} className="text-xs">
                      {it.product?.name ?? "—"}
                      {it.variation?.name ? <span className="text-muted-foreground"> · {it.variation.name}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 grid grid-cols-4 gap-2 border-t pt-3 text-xs">
                <div><div className="text-muted-foreground">Qty</div><div className="font-semibold">{totalQty}</div></div>
                <div><div className="text-muted-foreground">Total</div><div className="font-semibold">${Number(p.total).toFixed(2)}</div></div>
                <div><div className="text-muted-foreground">Paid</div><div className="font-semibold">${Number(p.paid ?? 0).toFixed(2)}</div></div>
                <div><div className="text-muted-foreground">Due</div><div className={`font-semibold ${due > 0 ? "text-destructive" : "text-green-600"}`}>${due.toFixed(2)}</div></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Invoice No.</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">Products</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">Paid</th>
              <th className="px-4 py-3 text-right font-semibold">Due</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t"><td colSpan={9} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>
              ))
            ) : (rows as any[]).length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12"><EmptyState onNew={() => navigate({ to: "/admin/purchases/new" })} /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12"><NoResults onClear={clearFilters} /></td></tr>
            ) : filtered.map((p) => {
              const due = Math.max(0, Number(p.total) - Number(p.paid ?? 0));
              const items = (p.items ?? []) as any[];
              const totalQty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
              return (
              <tr key={p.id} className="border-t align-top">
                <td className="px-4 py-3">{p.purchase_date}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                <td className="px-4 py-3">{p.supplier?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {items.length === 0 ? "—" : (
                    <ul className="space-y-0.5">
                      {items.map((it) => (
                        <li key={it.id} className="text-xs">
                          {it.product?.name ?? "—"}
                          {it.variation?.name ? <span className="text-muted-foreground"> · {it.variation.name}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{totalQty}</td>
                <td className="px-4 py-3 text-right font-semibold">${Number(p.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">${Number(p.paid ?? 0).toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${due > 0 ? "text-destructive" : "text-green-600"}`}>${due.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link to="/admin/purchases/$id" params={{ id: p.id }}>
                      <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => {
                      if (confirm("Delete purchase? Stock will be decreased.")) del.mutate(p.id);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
        <ShoppingBag className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold">No purchases yet</p>
        <p className="text-sm text-muted-foreground">Record your first supplier purchase to update stock.</p>
      </div>
      <Button size="sm" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> New purchase</Button>
    </div>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
        <Search className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold">No matching purchases</p>
        <p className="text-sm text-muted-foreground">Try a different invoice number, supplier, or date range.</p>
      </div>
      <Button size="sm" variant="outline" onClick={onClear}><X className="mr-1 h-4 w-4" /> Clear filters</Button>
    </div>
  );
}
