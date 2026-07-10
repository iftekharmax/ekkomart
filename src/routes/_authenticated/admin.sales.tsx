import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { listPosSales, deletePosSale, getPosSale } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye, Trash2, Search, Receipt, Printer, Calendar, X, TrendingUp, ShoppingBag,
  Download, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";

import { toast } from "sonner";
import { printThermalReceipt } from "@/lib/thermal-print";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const searchSchema = z.object({
  q: z.string().optional().default(""),
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  page: z.number().int().min(1).optional().default(1),
});

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — Admin" }] }),
  validateSearch: searchSchema,
  component: SalesPage,
});

const PAGE_SIZE = 15;
const money = (n: number) => `৳${(Number(n) || 0).toFixed(2)}`;
const fmtDT = (s: string) => new Date(s).toLocaleString();

function SalesPage() {
  const qc = useQueryClient();
  const nav = useNavigate({ from: "/admin/sales" });
  const { q, from, to, page } = Route.useSearch();
  const listFn = useServerFn(listPosSales);
  const delFn = useServerFn(deletePosSale);
  const getFn = useServerFn(getPosSale);

  const [confirmSale, setConfirmSale] = useState<{ id: string; invoice: string } | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const setSearch = (patch: Partial<{ q: string; from: string; to: string; page: number }>) => {
    const next = { q, from, to, page, ...patch };
    if (!("page" in patch)) next.page = 1;
    nav({ to: ".", search: next });
  };

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: async (_res, id) => {
      const inv = confirmSale?.invoice ?? rows.find((r) => r.id === id)?.invoice ?? "sale";
      toast.success(`Deleted ${inv} — stock restored`);
      setConfirmSale(null);
      await qc.invalidateQueries({ queryKey: ["admin-sales"] });
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete sale"),
  });

  const exportCsv = async () => {
    if (filtered.length === 0) { toast.error("Nothing to export"); return; }
    setIsExporting(true);
    try {
      // yield to UI so spinner paints
      await new Promise((r) => setTimeout(r, 0));
      const headers = [
        "Invoice", "Date", "Time", "Customer", "Payment",
        "Item Count", "Total Qty", "Subtotal", "Discount", "Tax", "Total",
      ];
      const esc = (v: unknown) => {
        const s = String(v ?? "");
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const num = (n: number) => (Number(n) || 0).toFixed(2);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmtDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const fmtTime = (iso: string) => {
        const d = new Date(iso);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };
      const lines = [headers.map(esc).join(",")];
      for (const r of filtered) {
        lines.push([
          r.invoice, fmtDate(r.created_at), fmtTime(r.created_at),
          r.customer ?? "Walk-in", r.payment_method,
          r.items_count, r.quantity,
          num(r.subtotal), num(r.discount), num(r.tax), num(r.total),
        ].map(esc).join(","));
      }
      lines.push("");
      lines.push([
        "TOTAL", "", "", "", "", filtered.length, totalQty,
        num(filtered.reduce((s, r) => s + r.subtotal, 0)),
        num(filtered.reduce((s, r) => s + r.discount, 0)),
        num(filtered.reduce((s, r) => s + r.tax, 0)),
        num(totalAmount),
      ].map(esc).join(","));
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filtered.length} sale${filtered.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

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
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setSearch({ q: e.target.value })}
              placeholder="Search by customer or invoice…"
              className="h-11 rounded-xl pl-9 text-sm font-medium"
              aria-label="Search sales"
            />
            {q && (
              <button onClick={() => setSearch({ q: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={from} onChange={(e) => setSearch({ from: e.target.value })} aria-label="From date" className="h-11 rounded-xl pl-9 sm:w-[170px]" />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={to} onChange={(e) => setSearch({ to: e.target.value })} aria-label="To date" className="h-11 rounded-xl pl-9 sm:w-[170px]" />
          </div>
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            disabled={!hasFilters}
            onClick={() => nav({ to: ".", search: { q: "", from: "", to: "", page: 1 } })}
          >
            <X className="mr-1 h-4 w-4" />Clear
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={exportCsv} disabled={isExporting || filtered.length === 0} aria-label="Export all filtered sales to CSV">
            {isExporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            {isExporting ? "Exporting…" : `Export (${filtered.length})`}
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
              ) : pageRows.map((r) => (
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
                        onClick={() => setViewId(r.id)}
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
                        onClick={() => setConfirmSale({ id: r.id, invoice: r.invoice })}
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

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row">
            <div className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{(curPage - 1) * PAGE_SIZE + 1}</span>–
              <span className="font-semibold text-foreground">{Math.min(curPage * PAGE_SIZE, filtered.length)}</span> of{" "}
              <span className="font-semibold text-foreground">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8" disabled={curPage <= 1}
                onClick={() => setSearch({ page: curPage - 1 })}>
                <ChevronLeft className="h-4 w-4" />Prev
              </Button>
              <span className="rounded-md border bg-card px-3 py-1 font-mono text-xs font-semibold">
                {curPage} / {totalPages}
              </span>
              <Button size="sm" variant="outline" className="h-8" disabled={curPage >= totalPages}
                onClick={() => setSearch({ page: curPage + 1 })}>
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmSale} onOpenChange={(o) => !o && setConfirmSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sale?</AlertDialogTitle>
            <AlertDialogDescription>
              Invoice <span className="font-mono font-semibold text-foreground">{confirmSale?.invoice}</span> will be permanently removed and its stock restored. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={(e) => { e.preventDefault(); if (confirmSale) del.mutate(confirmSale.id); }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {del.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View details modal */}
      <SaleDetailsDialog
        id={viewId}
        onClose={() => setViewId(null)}
        getFn={getFn}
      />

    </div>
  );
}

function SaleDetailsDialog({
  id, onClose, getFn,
}: { id: string | null; onClose: () => void; getFn: (args: { data: { id: string } }) => Promise<Awaited<ReturnType<typeof getPosSale>>> }) {

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-sale", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
  });

  const status = data ? (data.paid >= data.total ? "Paid" : data.paid > 0 ? "Partial" : "Unpaid") : "";
  const statusCls = status === "Paid"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    : status === "Partial"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0" aria-busy={isLoading}>
        <DialogHeader className="border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5 text-primary" aria-hidden />Sale details
          </DialogTitle>
          <DialogDescription>
            {isLoading ? "Loading sale…" : data ? <>Invoice <span className="font-mono font-semibold text-foreground">{data.invoice}</span> · {fmtDT(data.created_at)}</> : "No sale selected"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Fetching sale details…</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-destructive">Failed to load sale.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : !data ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No details available.</p>
          ) : data.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">This sale has no items.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetaCell label="Customer" value={data.customer || "Walk-in"} />
                <MetaCell label="Payment" value={<span className="capitalize">{data.payment_method}</span>} />
                <MetaCell label="Staff" value={(data as any).staff || <span className="text-muted-foreground">—</span>} />
                <MetaCell label="Status" value={<span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusCls}`}>{status}</span>} />
              </div>

              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Item</th>
                      <th className="px-3 py-2 text-right font-semibold">Price</th>
                      <th className="px-3 py-2 text-right font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it: { id: string; name: string; qty: number; price: number }) => {
                      const sepIdx = it.name.indexOf(" - ");
                      const baseName = sepIdx > 0 ? it.name.slice(0, sepIdx) : it.name;
                      const variation = sepIdx > 0 ? it.name.slice(sepIdx + 3).trim() : "";
                      return (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2 font-medium">
                            <div>{baseName}</div>
                            {variation && (
                              <div className="mt-0.5 inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                {variation}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(it.price)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(it.price * it.qty)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(() => {
                const sub = data.subtotal || 0;
                const discPct = sub > 0 ? (data.discount / sub) * 100 : 0;
                const taxPct = sub > 0 ? (data.tax / sub) * 100 : 0;
                return (
                  <div className="ml-auto grid w-full max-w-sm gap-1 rounded-xl border bg-muted/20 p-4 text-sm">
                    <SumRow label="Subtotal" value={money(sub)} />
                    <SumRow
                      label={`Discount${data.discount ? ` (${discPct.toFixed(discPct % 1 ? 1 : 0)}%)` : ""}`}
                      value={data.discount ? `− ${money(data.discount)}` : <span className="font-semibold text-emerald-600">FREE</span>}
                    />
                    <SumRow
                      label={`Tax${data.tax ? ` (${taxPct.toFixed(taxPct % 1 ? 1 : 0)}%)` : ""}`}
                      value={data.tax ? `+ ${money(data.tax)}` : <span className="font-semibold text-emerald-600">FREE</span>}
                    />
                    <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-bold">
                      <span>Total</span><span className="tabular-nums text-primary">{money(data.total)}</span>
                    </div>
                    <SumRow label="Paid" value={money(data.paid)} />
                    <SumRow label="Change" value={money(Math.max(0, data.paid - data.total))} />
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {data && (
            <Button variant="outline" onClick={() => printThermalReceipt(data)}>
              <Printer className="mr-1 h-4 w-4" />Print
            </Button>
          )}

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
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
