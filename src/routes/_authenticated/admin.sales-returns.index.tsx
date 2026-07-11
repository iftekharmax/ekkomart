import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSalesReturns, deleteSalesReturn, voidSalesReturn,
} from "@/lib/sales-returns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, Trash2, Search, Undo2, Ban, Calendar, X, TrendingUp, ShoppingBag, Plus,
  ChevronLeft, ChevronRight, Loader2, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/sales-returns/")({
  head: () => ({ meta: [{ title: "Sales Returns — Admin" }] }),
  component: SalesReturnsPage,
});

const PAGE_SIZE = 15;
const money = (n: number) => `৳${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString();

function SalesReturnsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listSalesReturns);
  const delFn = useServerFn(deleteSalesReturn);
  const voidFn = useServerFn(voidSalesReturn);

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-sales-returns"],
    queryFn: () => listFn(),
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [confirmRow, setConfirmRow] = useState<{ id: string; reference: string } | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<{ id: string; reference: string } | null>(null);

  const hasFilters = !!(q || status !== "all" || from || to);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows as any[]).filter((r) => {
      if (status !== "all" && (r.status ?? "completed") !== status) return false;
      if (from && r.return_date < from) return false;
      if (to && r.return_date > to) return false;
      if (needle) {
        const hay = [r.reference, r.customer].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, status, from, to]);

  const totalAmount = filtered.reduce((s, r) => s + Number(r.total || 0), 0);
  const totalQty = filtered.reduce(
    (s, r) => s + (r.items ?? []).reduce((x: number, it: any) => x + Number(it.quantity ?? 0), 0),
    0,
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Return deleted — stock reverted");
      setConfirmRow(null);
      qc.invalidateQueries({ queryKey: ["admin-sales-returns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidIt = useMutation({
    mutationFn: (id: string) => voidFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Return voided — stock reverted");
      setConfirmVoid(null);
      qc.invalidateQueries({ queryKey: ["admin-sales-returns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearAll = () => { setQ(""); setStatus("all"); setFrom(""); setTo(""); setPage(1); };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">Returns</p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-tight sm:text-3xl">Sales Returns</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accept returns from customers — stock is restored automatically.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
          <StatCard icon={<Receipt className="h-4 w-4" />} label="Returns" value={String(filtered.length)} />
          <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Items" value={String(totalQty)} />
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Total" value={money(totalAmount)} accent />
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search reference or customer…"
              className="h-11 rounded-xl pl-9 text-sm font-medium"
              aria-label="Search returns"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Clear">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-11 rounded-xl sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" className="h-11 rounded-xl pl-9 sm:w-[170px]" />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" className="h-11 rounded-xl pl-9 sm:w-[170px]" />
          </div>
          <Button variant="outline" className="h-11 rounded-xl" disabled={!hasFilters} onClick={clearAll}>
            <X className="mr-1 h-4 w-4" />Clear
          </Button>
          <Button className="h-11 rounded-xl" onClick={() => navigate({ to: "/admin/sales-returns/new" })}>
            <Plus className="mr-1 h-4 w-4" />New return
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Items</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={8} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <p className="mb-2 text-sm text-destructive">Failed to load returns.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                      <Undo2 className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{hasFilters ? "No returns match these filters" : "No sales returns yet"}</p>
                      <p className="text-sm text-muted-foreground">
                        {hasFilters ? "Try clearing search, status, or date range." : "Accept a customer return to restore stock."}
                      </p>
                    </div>
                    {!hasFilters && (
                      <Button size="sm" onClick={() => navigate({ to: "/admin/sales-returns/new" })}>
                        <Plus className="mr-1 h-4 w-4" /> New return
                      </Button>
                    )}
                  </div>
                </td></tr>
              ) : pageRows.map((r: any) => {
                const items = (r.items ?? []) as any[];
                const qty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
                const voided = r.status === "voided";
                return (
                  <tr key={r.id} className={`border-t transition-colors hover:bg-muted/30 ${voided ? "opacity-70" : ""}`}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        {r.reference}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.return_date)}</td>
                    <td className="px-4 py-3 font-medium">{r.customer || <span className="text-muted-foreground">Walk-in</span>}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status ?? "completed"} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{items.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{qty}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">{money(r.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon" variant="outline" className="h-8 w-8"
                          title="View details" aria-label="View return"
                          onClick={() => navigate({ to: "/admin/sales-returns/$id", params: { id: r.id } })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!voided && (
                          <Button
                            size="icon" variant="outline" className="h-8 w-8"
                            title="Void return" aria-label="Void return"
                            onClick={() => setConfirmVoid({ id: r.id, reference: r.reference })}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon" variant="outline"
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
                          title="Delete" aria-label="Delete return"
                          onClick={() => setConfirmRow({ id: r.id, reference: r.reference })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row">
            <div className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{(curPage - 1) * PAGE_SIZE + 1}</span>–
              <span className="font-semibold text-foreground">{Math.min(curPage * PAGE_SIZE, filtered.length)}</span> of{" "}
              <span className="font-semibold text-foreground">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>
                <ChevronLeft className="h-4 w-4" />Prev
              </Button>
              <span className="rounded-md border bg-card px-3 py-1 font-mono text-xs font-semibold">
                {curPage} / {totalPages}
              </span>
              <Button size="sm" variant="outline" className="h-8" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this return?</AlertDialogTitle>
            <AlertDialogDescription>
              Return <span className="font-mono font-semibold text-foreground">{confirmRow?.reference}</span> will be permanently removed and its stock reverted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={(e) => { e.preventDefault(); if (confirmRow) del.mutate(confirmRow.id); }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {del.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void confirm */}
      <AlertDialog open={!!confirmVoid} onOpenChange={(o) => !o && setConfirmVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this return?</AlertDialogTitle>
            <AlertDialogDescription>
              Return <span className="font-mono font-semibold text-foreground">{confirmVoid?.reference}</span> will be marked voided and its stock reverted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidIt.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={voidIt.isPending}
              onClick={(e) => { e.preventDefault(); if (confirmVoid) voidIt.mutate(confirmVoid.id); }}
            >
              {voidIt.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Voiding…</> : "Void"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const voided = status === "voided";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${voided ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
      {status}
    </span>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${accent ? "bg-primary/10 text-primary" : "bg-card"}`}>
      <div className={`grid h-8 w-8 place-items-center rounded-lg ${accent ? "bg-primary/20" : "bg-muted"}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
