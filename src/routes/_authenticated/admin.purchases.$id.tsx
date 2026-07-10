import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPurchase, deletePurchase, payPurchaseDue } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trash2, DollarSign } from "lucide-react";
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

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!data) return <div className="text-muted-foreground">Not found.</div>;
  const { header, items, payments } = data as any;
  const due = Math.max(0, Number(header.total) - Number(header.paid));
  const status = due <= 0 ? "Paid" : Number(header.paid) > 0 ? "Partial" : "Unpaid";

  return (
    <div className="max-w-4xl">
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

      <div className="overflow-x-auto rounded-xl border bg-card">
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

      <div className="mt-6 grid gap-3 rounded-xl border bg-card p-6 md:w-80 md:ml-auto">
        <Row label="Subtotal" value={`$${Number(header.subtotal).toFixed(2)}`} />
        <Row label="Discount" value={`-$${Number(header.discount).toFixed(2)}`} />
        <Row label="Tax" value={`$${Number(header.tax).toFixed(2)}`} />
        <Row label="Shipping" value={`$${Number(header.shipping).toFixed(2)}`} />
        <div className="flex justify-between border-t pt-3 text-lg font-bold">
          <span>Total</span><span>${Number(header.total).toFixed(2)}</span>
        </div>
        <Row label="Paid" value={`$${Number(header.paid).toFixed(2)}`} />
        <div className={`flex justify-between text-sm font-semibold ${due > 0 ? "text-destructive" : "text-green-600"}`}>
          <span>Due</span><span>${due.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        <div className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">Payment history</div>
        {(payments ?? []).length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No payments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
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
        )}
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
            <div>
              <Label>Amount</Label>
              <Input type="number" min={0} max={due} step="0.01" value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value) || 0)} autoFocus />
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
