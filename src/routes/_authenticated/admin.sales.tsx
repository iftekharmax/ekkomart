import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listPosSales, deletePosSale } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Trash2, Search, Receipt, Printer, Calendar, X, TrendingUp, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { printThermalReceipt } from "@/lib/thermal-print";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — Admin" }] }),
  component: SalesPage,
});

const money = (n: number) => `৳${(Number(n) || 0).toFixed(2)}`;
const fmtDT = (s: string) => new Date(s).toLocaleString();

function SalesPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const listFn = useServerFn(listPosSales);
  const delFn = useServerFn(deletePosSale);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-sales"],
    queryFn: () => listFn(),
  });

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59.999").getTime() : null;
    const list = rows.filter((r) => {
      if (qq && !(r.customer ?? "").toLowerCase().includes(qq) && !r.invoice.toLowerCase().includes(qq)) return false;
      const ts = new Date(r.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [rows, q, from, to]);

  const totalAmount = filtered.reduce((s, r) => s + r.total, 0);
  const totalQty = filtered.reduce((s, r) => s + r.quantity, 0);
  const hasFilters = !!(q || from || to);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Sale deleted — stock restored");
      await qc.invalidateQueries({ queryKey: ["admin-sales"] });
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete sale"),
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">POS ledger</p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">Sales</h2>
          <p className="mt-1 text-sm text-muted-foreground">Browse, print, and manage every point-of-sale transaction.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
          <StatCard icon={<Receipt className="h-4 w-4" />} label="Sales" value={String(filtered.length)} />
          <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Items" value={String(totalQty)} />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Total" value={money(totalAmount)} accent />
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by customer or invoice…"
              className="h-11 rounded-xl pl-9 text-sm font-medium"
              aria-label="Search sales"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="h-11 rounded-xl pl-9 sm:w-[170px]" />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="h-11 rounded-xl pl-9 sm:w-[170px]" />
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={!hasFilters}
            onClick={() => { setQ(""); setFrom(""); setTo(""); }}
          >
            <X className="mr-1 h-4 w-4" />Clear
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left font-semibold">Invoice</th>
                <th className="px-4 py-3 text-left font-semibold">Date / Time</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Payment</th>
                <th className="px-4 py-3 text-right font-semibold">Items</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Tax</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={9} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <p className="mb-2 text-sm text-destructive">Failed to load sales.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                      <Receipt className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">No sales found</p>
                      <p className="text-sm text-muted-foreground">{hasFilters ? "Try different filters." : "POS sales will appear here."}</p>
                    </div>
                  </div>
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      {r.invoice}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDT(r.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{r.customer || <span className="text-muted-foreground">Walk-in</span>}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {r.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.items_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{money(r.tax)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">{money(r.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        title="View details"
                        aria-label="View sale"
                        onClick={() => nav({ to: "/admin/sales/$id", params: { id: r.id } })}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        title="Print receipt"
                        aria-label="Print receipt"
                        onClick={() => printThermalReceipt({
                          invoice: r.invoice, created_at: r.created_at, customer: r.customer, payment_method: r.payment_method,
                          items: r.items, subtotal: r.subtotal, discount: r.discount, tax: r.tax, total: r.total, paid: r.total,
                        })}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
                        title="Delete"
                        aria-label="Delete sale"
                        disabled={del.isPending}
                        onClick={() => {
                          if (confirm(`Delete ${r.invoice}? Stock will be restored.`)) del.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2 sm:min-w-[130px] ${accent ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-0.5 text-base font-bold tabular-nums sm:text-lg ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
