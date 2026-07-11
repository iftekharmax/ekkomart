import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listSalesReturns, deleteSalesReturn, voidSalesReturn, getSalesReturn,
} from "@/lib/sales-returns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Eye, Trash2, Search, Undo2, Ban, Calendar, X, TrendingUp, ShoppingBag, Plus,
  ChevronLeft, ChevronRight, Loader2, Receipt, Printer, CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { printSalesReturnReceipt } from "@/lib/sales-return-print";

export const Route = createFileRoute("/_authenticated/admin/sales-returns/")({
  head: () => ({ meta: [{ title: "Sales Returns — Admin" }] }),
  component: SalesReturnsPage,
});

const PAGE_SIZE = 15;
const money = (n: number) => `৳${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString();
const fmtDT = (s: string) => new Date(s).toLocaleString();

function SalesReturnsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listSalesReturns);
  const delFn = useServerFn(deleteSalesReturn);
  const voidFn = useServerFn(voidSalesReturn);
  const getFn = useServerFn(getSalesReturn);

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
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

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
    mutationFn: (vars: { id: string; reason: string }) => voidFn({ data: vars }),
    onSuccess: () => {
      toast.success("Sales return voided — stock reverted");
      setConfirmVoid(null);
      setVoidReason("");
      setVoidError(null);
      qc.invalidateQueries({ queryKey: ["admin-sales-returns"] });
      if (detailId) qc.invalidateQueries({ queryKey: ["admin-sales-return", detailId] });
    },
    onError: (e: Error) => {
      // Keep the dialog open so the user can correct and retry
      setVoidError(e.message || "Failed to void return");
      toast.error(e.message || "Failed to void return");
    },
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
                <th className="px-4 py-3 text-left font-semibold">Staff</th>
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
                    <td colSpan={9} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <p className="mb-2 text-sm text-destructive">Failed to load returns.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16">
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
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {(r.creator_name ?? "S").slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-medium">{r.creator_name ?? <span className="text-muted-foreground">System</span>}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={r.status ?? "completed"} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{items.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{qty}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">{money(r.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon" variant="outline" className="h-8 w-8"
                          title="View details" aria-label="View return"
                          onClick={() => setDetailId(r.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!voided && (
                          <Button
                            size="icon" variant="outline" className="h-8 w-8"
                            title="Void return" aria-label="Void return"
                            onClick={() => { setConfirmVoid({ id: r.id, reference: r.reference }); setVoidReason(""); setVoidError(null); }}
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

      {/* Detail modal */}
      <ReturnDetailModal
        id={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        getFn={getFn}
        onVoid={(id, reference) => { setDetailId(null); setConfirmVoid({ id, reference }); setVoidReason(""); setVoidError(null); }}
        onDelete={(id, reference) => { setDetailId(null); setConfirmRow({ id, reference }); }}
      />

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

      {/* Void confirm w/ reason */}
      <AlertDialog open={!!confirmVoid} onOpenChange={(o) => { if (!o) { setConfirmVoid(null); setVoidReason(""); setVoidError(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Void this return?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Return <span className="font-mono font-semibold text-foreground">{confirmVoid?.reference}</span> will be marked
              voided and its stock will be reverted from inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason for voiding <span className="text-rose-600">*</span></Label>
            <Textarea
              id="void-reason" rows={3}
              value={voidReason}
              onChange={(e) => { setVoidReason(e.target.value); if (voidError) setVoidError(null); }}
              placeholder="e.g. duplicate entry, customer changed mind, wrong return processed…"
              className={voidError ? "border-rose-500 focus-visible:ring-rose-500" : ""}
              autoFocus
            />
            {voidError && <p className="text-xs font-medium text-rose-600">{voidError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidIt.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={voidIt.isPending}
              onClick={(e) => {
                e.preventDefault();
                const reason = voidReason.trim();
                if (reason.length < 3) {
                  const msg = "Please provide a reason (min 3 characters)";
                  setVoidError(msg);
                  toast.error(msg);
                  return;
                }
                if (confirmVoid) voidIt.mutate({ id: confirmVoid.id, reason });
              }}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {voidIt.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Voiding…</> : "Void return"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReturnDetailModal({
  id, onOpenChange, getFn, onVoid, onDelete,
}: {
  id: string | null;
  onOpenChange: (open: boolean) => void;
  getFn: (args: { data: { id: string } }) => Promise<any>;
  onVoid: (id: string, reference: string) => void;
  onDelete: (id: string, reference: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-sales-return", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
  });

  const header = data?.header;
  const items = (data?.items ?? []) as any[];
  const voided = header?.status === "voided";

  const handlePrint = () => {
    if (!header) return;
    printSalesReturnReceipt({
      reference: header.reference,
      return_date: header.return_date,
      created_at: header.created_at,
      customer: header.customer,
      reason: header.reason,
      notes: header.notes,
      status: header.status,
      staff: header.creator_name,
      voided_by_name: header.voider_name,
      voided_at: header.voided_at,
      items: items.map((it) => ({
        name: `${it.product?.name ?? "—"}${it.variation?.name ? " · " + it.variation.name : ""}`,
        qty: Number(it.quantity),
        price: Number(it.unit_price),
      })),
      subtotal: Number(header.subtotal),
      total: Number(header.total),
    });
  };

  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0 sm:rounded-2xl w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col overflow-hidden [&>button]:top-3 [&>button]:right-3 [&>button]:z-20 [&>button]:h-8 [&>button]:w-8 [&>button]:rounded-full [&>button]:bg-background/80 [&>button]:backdrop-blur [&>button]:shadow-sm [&>button]:border">
        <DialogHeader className="sr-only"><DialogTitle>Sales return details</DialogTitle></DialogHeader>
        {isLoading || !header ? (
          <div className="p-8"><div className="h-40 animate-pulse rounded bg-muted" /></div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col">
            {/* Sticky header */}
            <div className={`sticky top-0 z-10 border-b px-4 py-4 pr-14 sm:px-5 ${voided ? "bg-muted/60 backdrop-blur" : "bg-gradient-to-br from-primary/10 via-background to-background backdrop-blur"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  {header.reference}
                </span>
                <StatusPill status={header.status ?? "completed"} />
              </div>
              <h2 className="mt-2 truncate text-lg font-bold sm:text-xl">{header.customer || "Walk-in customer"}</h2>
              <p className="text-xs text-muted-foreground">
                Return date · {fmtDate(header.return_date)} · Processed by{" "}
                <span className="font-semibold text-foreground">{header.creator_name ?? "System"}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  <Printer className="mr-1 h-4 w-4" />Print
                </Button>
                {!voided && (
                  <Button size="sm" variant="outline" onClick={() => onVoid(header.id, header.reference)}>
                    <Ban className="mr-1 h-4 w-4" />Void
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => onDelete(header.id, header.reference)}>
                  <Trash2 className="mr-1 h-4 w-4" />Delete
                </Button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="space-y-5">
                {/* items */}
                <div className="overflow-hidden rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Items ({items.length})
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 text-left">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Item</th>
                        <th className="px-3 py-2 text-right font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold">Unit</th>
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">
                            {it.product?.name ?? "—"}
                            {it.variation?.name && <span className="text-muted-foreground"> · {it.variation.name}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(Number(it.unit_price))}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(Number(it.line_total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(header.reason || header.notes) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {header.reason && (
                      <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Reason</div>
                        <div className="mt-1">{header.reason}</div>
                      </div>
                    )}
                    {header.notes && (
                      <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</div>
                        <div className="mt-1 whitespace-pre-wrap">{header.notes}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* audit timeline */}
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    History
                  </div>
                  <ol className="relative space-y-4 p-4 pl-8">
                    <span className="absolute left-4 top-4 bottom-4 w-px bg-border" aria-hidden />
                    <TimelineItem
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      color="bg-emerald-500"
                      title="Return created"
                      subtitle={`by ${header.creator_name ?? "System"} · stock restored`}
                      time={header.created_at}
                    />
                    {voided ? (
                      <TimelineItem
                        icon={<Ban className="h-3.5 w-3.5" />}
                        color="bg-amber-500"
                        title="Return voided"
                        subtitle={header.void_reason
                          ? `by ${header.voider_name ?? "System"} · reason: ${header.void_reason}`
                          : `by ${header.voider_name ?? "System"}`}
                        time={header.voided_at ?? header.updated_at}
                      />
                    ) : (
                      <TimelineItem
                        icon={<Clock className="h-3.5 w-3.5" />}
                        color="bg-muted-foreground/60"
                        title="Active"
                        subtitle="Awaiting further action"
                        time={header.updated_at}
                      />
                    )}
                  </ol>
                </div>
              </div>

              {/* summary */}
              <aside className="space-y-3">
                <div className="rounded-lg border bg-card p-4 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(Number(header.subtotal))}</span></div>
                  <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total refund</span>
                    <span className="tabular-nums text-primary">{money(Number(header.total))}</span>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                  <div className="font-semibold text-foreground">Order</div>
                  <div className="mt-0.5 font-mono text-muted-foreground">
                    {header.order_id ? `INV-${String(header.order_id).slice(0, 8).toUpperCase()}` : "Manual entry"}
                  </div>
                </div>
              </aside>
            </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TimelineItem({ icon, color, title, subtitle, time }: {
  icon: React.ReactNode; color: string; title: string; subtitle?: string; time?: string;
}) {
  return (
    <li className="relative">
      <span className={`absolute -left-[18px] top-0.5 grid h-6 w-6 place-items-center rounded-full text-white shadow ${color}`}>
        {icon}
      </span>
      <div className="text-sm font-semibold">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      {time && <div className="mt-0.5 text-[11px] font-mono text-muted-foreground">{fmtDT(time)}</div>}
    </li>
  );
}

function short(uid?: string | null) {
  if (!uid) return "system";
  return uid.slice(0, 8);
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
