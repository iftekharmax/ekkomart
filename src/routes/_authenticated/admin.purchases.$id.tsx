import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPurchase, deletePurchase, payPurchaseDue } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const pay = useMutation({
    mutationFn: () => payFn({ data: { id, amount: Number(payAmount) } }),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["admin-purchase", id] });
      qc.invalidateQueries({ queryKey: ["admin-purchases"] });
      setPayOpen(false); setPayAmount(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!data) return <div className="text-muted-foreground">Not found.</div>;
  const { header, items } = data as any;
  const due = Math.max(0, Number(header.total) - Number(header.paid));

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/admin/purchases" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h2 className="text-2xl font-bold">Purchase {header.reference}</h2>
          <p className="text-sm text-muted-foreground">
            {header.purchase_date} · {header.supplier?.name ?? "No supplier"}
          </p>
        </div>
        <div className="flex gap-2">
          {due > 0 && (
            <Button onClick={() => { setPayAmount(due); setPayOpen(true); }}>
              <DollarSign className="mr-2 h-4 w-4" /> Pay due
            </Button>
          )}
          <Button variant="outline" onClick={() => {
            if (confirm("Delete purchase? Stock will be decreased.")) del.mutate();
          }}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
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
        <div className={`flex justify-between text-sm font-semibold ${(Number(header.total) - Number(header.paid)) > 0 ? "text-destructive" : "text-green-600"}`}>
          <span>Due</span><span>${Math.max(0, Number(header.total) - Number(header.paid)).toFixed(2)}</span>
        </div>
      </div>

      {header.note && (
        <div className="mt-6 rounded-xl border bg-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Note</div>
          <p className="mt-1 text-sm">{header.note}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
