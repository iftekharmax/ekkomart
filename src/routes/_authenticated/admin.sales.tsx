import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listPosSales, getPosSale, deletePosSale, updatePosSale } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Pencil, Trash2, Search, Receipt, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — Admin" }] }),
  component: SalesPage,
});

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDT = (s: string) => new Date(s).toLocaleString();

function SalesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPosSales);
  const getFn = useServerFn(getPosSale);
  const delFn = useServerFn(deletePosSale);
  const updFn = useServerFn(updatePosSale);

  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState("");
  const [editMethod, setEditMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-sales"],
    queryFn: () => listFn(),
  });

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) =>
      r.invoice.toLowerCase().includes(qq) ||
      (r.customer ?? "").toLowerCase().includes(qq),
    );
  }, [rows, q]);

  const totalAmount = filtered.reduce((s, r) => s + r.total, 0);

  const viewQ = useQuery({
    queryKey: ["admin-sale", viewId],
    queryFn: () => getFn({ data: { id: viewId! } }),
    enabled: !!viewId,
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Sale deleted (stock restored)");
      qc.invalidateQueries({ queryKey: ["admin-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: () => updFn({ data: { id: editId!, customer: editCustomer || null, payment_method: editMethod } }),
    onSuccess: () => {
      toast.success("Sale updated");
      qc.invalidateQueries({ queryKey: ["admin-sales"] });
      setEditId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = async (id: string) => {
    setEditId(id);
    try {
      const s = await getFn({ data: { id } });
      setEditCustomer(s.customer ?? "");
      setEditMethod((s.payment_method as any) ?? "cash");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Sales</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">All POS sales — view, edit or delete.</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-lg font-bold tabular-nums text-primary">{money(totalAmount)}</div>
        </div>
      </div>

      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by invoice or customer" className="pl-9" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Invoice</th>
              <th className="px-4 py-3 font-semibold">Date / Time</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 text-right font-semibold">Items</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t"><td colSpan={7} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>
              ))
            ) : isError ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center">
                <p className="mb-2 text-sm text-destructive">Failed to load sales.</p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                    <Receipt className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">No sales found</p>
                    <p className="text-sm text-muted-foreground">{q ? "Try a different search." : "POS sales will appear here."}</p>
                  </div>
                </div>
              </td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t align-middle">
                <td className="px-4 py-3 font-mono text-xs">{r.invoice}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDT(r.created_at)}</td>
                <td className="px-4 py-3">{r.customer || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.items_count}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.total)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setViewId(r.id)} title="View"><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(r.id)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      if (confirm("Delete this sale? Stock will be restored.")) del.mutate(r.id);
                    }} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View modal */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale details</DialogTitle>
          </DialogHeader>
          {viewQ.isLoading ? (
            <div className="h-40 animate-pulse rounded bg-muted" />
          ) : viewQ.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><div className="text-xs text-muted-foreground">Invoice</div><div className="font-mono font-semibold">{viewQ.data.invoice}</div></div>
                <div><div className="text-xs text-muted-foreground">Date</div><div className="font-medium">{fmtDT(viewQ.data.created_at)}</div></div>
                <div><div className="text-xs text-muted-foreground">Customer</div><div className="font-medium">{viewQ.data.customer || "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Payment</div><div className="font-medium capitalize">{viewQ.data.payment_method}</div></div>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Item</th>
                      <th className="px-3 py-2 text-right font-semibold">Price</th>
                      <th className="px-3 py-2 text-right font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewQ.data.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2">{it.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(it.price)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(it.price * it.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ml-auto grid max-w-xs gap-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(viewQ.data.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{money(viewQ.data.discount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{money(viewQ.data.tax)}</span></div>
                <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span className="tabular-nums text-primary">{money(viewQ.data.total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="tabular-nums">{money(viewQ.data.paid)}</span></div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer</label>
              <Input value={editCustomer} onChange={(e) => setEditCustomer(e.target.value)} placeholder="Walk-in" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Payment method</label>
              <Select value={editMethod} onValueChange={(v) => setEditMethod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}><X className="mr-1 h-4 w-4" />Cancel</Button>
            <Button onClick={() => upd.mutate()} disabled={upd.isPending}>{upd.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
