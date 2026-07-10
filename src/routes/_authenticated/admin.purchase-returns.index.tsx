import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPurchaseReturns, deletePurchaseReturn, voidPurchaseReturn } from "@/lib/purchase-returns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Eye, Undo2, Ban, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/purchase-returns/")({
  head: () => ({ meta: [{ title: "Purchase Returns — Admin" }] }),
  component: PurchaseReturnsPage,
});

function PurchaseReturnsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listPurchaseReturns);
  const delFn = useServerFn(deletePurchaseReturn);
  const voidFn = useServerFn(voidPurchaseReturn);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-purchase-returns"],
    queryFn: () => listFn(),
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows as any[]).filter((r) => {
      if (status !== "all" && (r.status ?? "completed") !== status) return false;
      if (from && r.return_date < from) return false;
      if (to && r.return_date > to) return false;
      if (needle) {
        const hay = [
          r.reference,
          r.purchase?.reference,
          r.supplier?.name,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, status, from, to]);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Return deleted (stock restored)");
      qc.invalidateQueries({ queryKey: ["admin-purchase-returns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voidIt = useMutation({
    mutationFn: (id: string) => voidFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Return voided (stock restored)");
      qc.invalidateQueries({ queryKey: ["admin-purchase-returns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold sm:text-2xl">Purchase Returns</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Return goods to suppliers — stock decreases automatically.
          </p>
        </div>
        <Button size="sm" onClick={() => navigate({ to: "/admin/purchase-returns/new" })}>
          <Plus className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">New return</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, invoice, supplier" className="pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
          ))
        ) : filtered.length === 0 ? (
          <EmptyState hasFilters={!!(q || status !== "all" || from || to)} onNew={() => navigate({ to: "/admin/purchase-returns/new" })} />
        ) : filtered.map((r) => {
          const items = (r.items ?? []) as any[];
          const qty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
          const voided = r.status === "voided";
          return (
            <div key={r.id} className={`rounded-xl border bg-card p-4 ${voided ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{r.reference}</div>
                  <div className="truncate text-sm font-semibold">{r.supplier?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.return_date}</div>
                  <StatusPill status={r.status ?? "completed"} />
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link to="/admin/purchase-returns/$id" params={{ id: r.id }}>
                    <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                  </Link>
                  {!voided && (
                    <Button size="sm" variant="outline" onClick={() => {
                      if (confirm("Void this return? Stock will be restored and it will stop reducing the supplier balance.")) voidIt.mutate(r.id);
                    }}><Ban className="h-4 w-4" /></Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {
                    if (confirm("Delete return permanently? Stock will be restored.")) del.mutate(r.id);
                  }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                <div><div className="text-muted-foreground">Qty</div><div className="font-semibold">{qty}</div></div>
                <div><div className="text-muted-foreground">Total</div><div className="font-semibold">${Number(r.total).toFixed(2)}</div></div>
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
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">Invoice</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t"><td colSpan={8} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12"><EmptyState hasFilters={!!(q || status !== "all" || from || to)} onNew={() => navigate({ to: "/admin/purchase-returns/new" })} /></td></tr>
            ) : filtered.map((r) => {
              const items = (r.items ?? []) as any[];
              const qty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
              const voided = r.status === "voided";
              return (
                <tr key={r.id} className={`border-t align-top ${voided ? "opacity-70" : ""}`}>
                  <td className="px-4 py-3">{r.return_date}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
                  <td className="px-4 py-3">{r.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.purchase?.reference ?? "—"}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status ?? "completed"} /></td>
                  <td className="px-4 py-3 text-right">{qty}</td>
                  <td className="px-4 py-3 text-right font-semibold">${Number(r.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to="/admin/purchase-returns/$id" params={{ id: r.id }}>
                        <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      {!voided && (
                        <Button size="sm" variant="outline" onClick={() => {
                          if (confirm("Void this return? Stock will be restored and it will stop reducing the supplier balance.")) voidIt.mutate(r.id);
                        }}><Ban className="h-4 w-4" /></Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => {
                        if (confirm("Delete return permanently? Stock will be restored.")) del.mutate(r.id);
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

function StatusPill({ status }: { status: string }) {
  const voided = status === "voided";
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${voided ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
      {status}
    </span>
  );
}

function EmptyState({ onNew, hasFilters }: { onNew: () => void; hasFilters?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
        <Undo2 className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold">{hasFilters ? "No returns match these filters" : "No purchase returns yet"}</p>
        <p className="text-sm text-muted-foreground">
          {hasFilters ? "Try clearing search, status, or date range." : "Return goods to a supplier to reduce stock."}
        </p>
      </div>
      {!hasFilters && <Button size="sm" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> New return</Button>}
    </div>
  );
}
