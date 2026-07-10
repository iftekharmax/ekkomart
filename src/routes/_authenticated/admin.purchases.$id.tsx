import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPurchase, deletePurchase, payPurchaseDue } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trash2, DollarSign, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/purchases/$id")({
  head: () => ({ meta: [{ title: "Purchase — Admin" }] }),
  component: PurchaseDetail,
});

function PurchaseDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getFn = useServerFn(getPurchase);
  const delFn = useServerFn(deletePurchase);
  const payFn = useServerFn(payPurchaseDue);
  const { data, isLoading } = useQuery({ queryKey: ["admin-purchase", id], queryFn: () => getFn({ data: { id } }) });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Purchase deleted (stock reversed)");
      qc.invalidateQueries({ queryKey: ["admin-purchases"] });
      navigate({ to: "/admin/purchases" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [receiptNo, setReceiptNo] = useState("");
  const [payNote, setPayNote] = useState("");
  const pay = useMutation({
    mutationFn: () => payFn({ data: { id, amount: Number(payAmount), receipt_no: receiptNo || null, note: payNote || null } }),
    onSuccess: async () => {
      toast.success("Payment recorded");
      await qc.invalidateQueries({ queryKey: ["admin-purchase", id] });
      await qc.refetchQueries({ queryKey: ["admin-purchase", id] });
      qc.invalidateQueries({ queryKey: ["admin-purchases"] });
      setPayOpen(false); setPayAmount(0); setReceiptNo(""); setPayNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
  if (!data) return (
    <div className="rounded-xl border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">Purchase not found. It may have been deleted.</p>
      <Button className="mt-4" size="sm" variant="outline" onClick={() => navigate({ to: "/admin/purchases" })}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to purchases
      </Button>
    </div>
  );
  const { header, items, payments, returns } = data as any;
  const activeReturns = (returns ?? []).filter((r: any) => r.status !== "voided");
  const returnedTotal = activeReturns.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);
  const paidTotal = Number(header.paid ?? 0);
  const total = Number(header.total);
  const due = Math.max(0, total - returnedTotal - paidTotal);
  const status = due <= 0 ? "Paid" : paidTotal > 0 ? "Partial" : "Unpaid";


  return (
    <div className="max-w-none">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link to="/admin/purchases" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h2 className="truncate text-xl font-bold sm:text-2xl">Purchase {header.reference}</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {header.purchase_date} · {header.supplier?.name ?? "No supplier"} ·{" "}
            <span className={due <= 0 ? "text-green-600" : "text-destructive"}>{status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {due > 0 && (
            <Button size="sm" onClick={() => { setPayAmount(due); setPayOpen(true); }}>
              <DollarSign className="mr-2 h-4 w-4" /> Pay due
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => {
            if (confirm("Delete purchase? Stock will be decreased.")) del.mutate();
          }}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
        </div>
      </div>

      {/* Items — mobile cards */}
      <div className="space-y-2 md:hidden">
        {items.map((it: any) => (
          <div key={it.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{it.product?.name ?? "—"}</div>
                {it.variation?.name && (
                  <div className="text-xs text-muted-foreground">{it.variation.name}</div>
                )}
              </div>
              <div className="shrink-0 text-right text-sm font-semibold">${Number(it.line_total).toFixed(2)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-xs">
              <div><div className="text-muted-foreground">Qty</div><div className="font-semibold">{Number(it.quantity)}</div></div>
              <div><div className="text-muted-foreground">Unit cost</div><div className="font-semibold">${Number(it.unit_cost).toFixed(2)}</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* Items — desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Variation</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Unit cost</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-3">{it.product?.name ?? "—"}</td>
                <td className="px-4 py-3">{it.variation?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right">{Number(it.quantity)}</td>
                <td className="px-4 py-3 text-right">${Number(it.unit_cost).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-semibold">${Number(it.line_total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">Payment history</div>
          {(payments ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              {due > 0 && (
                <Button size="sm" onClick={() => { setPayAmount(due); setPayOpen(true); }}>
                  <DollarSign className="mr-2 h-4 w-4" /> Record first payment
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="space-y-2 p-3 sm:hidden">
                {(payments as any[]).map((p) => (
                  <div key={p.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">{new Date(p.paid_at).toLocaleString()}</div>
                        {p.receipt_no && <div className="mt-0.5 font-mono text-xs">#{p.receipt_no}</div>}
                      </div>
                      <div className="shrink-0 text-sm font-semibold">${Number(p.amount).toFixed(2)}</div>
                    </div>
                    {p.note && <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{p.note}</p>}
                  </div>
                ))}
              </div>
              {/* Desktop table with horizontal scroll fallback */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/20 text-left">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Receipt #</th>
                      <th className="px-4 py-2 font-semibold">Note</th>
                      <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments as any[]).map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-4 py-2">{new Date(p.paid_at).toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono text-xs">{p.receipt_no ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{p.note ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-semibold">${Number(p.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>

        <div className="grid h-fit gap-3 rounded-xl border bg-card p-6">
          <Row label="Subtotal" value={`$${Number(header.subtotal).toFixed(2)}`} />
          <Row label="Discount" value={`-$${Number(header.discount).toFixed(2)}`} />
          <Row label="Tax" value={`$${Number(header.tax).toFixed(2)}`} />
          <Row label="Shipping" value={`$${Number(header.shipping).toFixed(2)}`} />
          <div className="flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span><span>${Number(header.total).toFixed(2)}</span>
          </div>
          {returnedTotal > 0 && (
            <Row label={`Returned (${activeReturns.length})`} value={`-$${returnedTotal.toFixed(2)}`} />
          )}
          <Row label="Paid" value={`$${paidTotal.toFixed(2)}`} />
          <div className={`flex justify-between text-sm font-semibold ${due > 0 ? "text-destructive" : "text-green-600"}`}>
            <span>Payable to supplier</span><span>${due.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Breakdown: how returned/paid/remaining are derived */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">
          Balance breakdown
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Returns ({(returns ?? []).length})</span>
              <span>-${returnedTotal.toFixed(2)}</span>
            </div>
            {(returns ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No returns.</p>
            ) : (
              <ul className="space-y-1">
                {(returns as any[]).map((r) => {
                  const voided = r.status === "voided";
                  return (
                    <li key={r.id}>
                      <Link to="/admin/purchase-returns/$id" params={{ id: r.id }}
                        className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/40 ${voided ? "opacity-60 line-through" : ""}`}>
                        <span className="min-w-0 truncate">
                          <span className="font-mono">{r.reference}</span>
                          <span className="text-muted-foreground"> · {r.return_date}</span>
                        </span>
                        <span className={`shrink-0 font-semibold ${voided ? "text-muted-foreground" : "text-destructive"}`}>
                          {voided ? "voided" : `-$${Number(r.total).toFixed(2)}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Payments ({(payments ?? []).length})</span>
              <span>${paidTotal.toFixed(2)}</span>
            </div>
            {(payments ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No payments.</p>
            ) : (
              <ul className="space-y-1">
                {(payments as any[]).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString()}{p.receipt_no ? ` · #${p.receipt_no}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold">${Number(p.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs">
            <div className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground">Remaining</div>
            <div className="space-y-1 font-mono">
              <div className="flex justify-between"><span>Total</span><span>${total.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>− Returned</span><span>${returnedTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>− Paid</span><span>${paidTotal.toFixed(2)}</span></div>
              <div className={`flex justify-between border-t pt-1 font-bold ${due > 0 ? "text-destructive" : "text-green-600"}`}>
                <span>= Due</span><span>${due.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>




      {header.note && (
        <div className="mt-6 rounded-xl border bg-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Note</div>
          <p className="mt-1 text-sm">{header.note}</p>
        </div>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay due — ${due.toFixed(2)}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-mono">${total.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">− Returned</span><span className="font-mono">${returnedTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">− Already paid</span><span className="font-mono">${paidTotal.toFixed(2)}</span></div>
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Remaining due</span><span className="font-mono">${due.toFixed(2)}</span></div>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" min={0} max={due} step="0.01" value={payAmount}
                onChange={(e) => setPayAmount(Math.min(due, Math.max(0, Number(e.target.value) || 0)))} autoFocus />
              <p className={`mt-1 text-xs ${payAmount > due ? "text-destructive" : "text-muted-foreground"}`}>
                {payAmount > due
                  ? `Exceeds remaining by $${(payAmount - due).toFixed(2)}`
                  : `Remaining after this payment: $${Math.max(0, due - payAmount).toFixed(2)}`}
              </p>
            </div>
            <div>
              <Label>Receipt # (optional)</Label>
              <Input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="e.g. RCPT-1024" />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={3} placeholder="Payment method, reference, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={() => pay.mutate()} disabled={pay.isPending || payAmount <= 0 || payAmount > due}>
              {pay.isPending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
