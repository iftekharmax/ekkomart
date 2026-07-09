import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdjustments, createAdjustment, deleteAdjustment } from "@/lib/stock-adjustments.functions";
import { listProducts, listAllVariations } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/stock-adjustments/")({ component: StockAdjustmentsPage });

type TargetKey = string; // "p:<product_id>" or "v:<product_id>:<variation_id>"

function StockAdjustmentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdjustments);
  const prodFn = useServerFn(listProducts);
  const varsFn = useServerFn(listAllVariations);
  const createFn = useServerFn(createAdjustment);
  const deleteFn = useServerFn(deleteAdjustment);

  const { data: adjustments = [] } = useQuery({ queryKey: ["stock-adjustments"], queryFn: () => listFn() });
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: () => prodFn() });
  const { data: variations = [] } = useQuery({ queryKey: ["admin-all-variations"], queryFn: () => varsFn() });

  const [target, setTarget] = useState<TargetKey>("");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState("initial");
  const [note, setNote] = useState("");

  const options = useMemo(() => {
    const varsByProduct = new Map<string, any[]>();
    for (const v of variations as any[]) {
      const arr = varsByProduct.get(v.product_id) ?? [];
      arr.push(v);
      varsByProduct.set(v.product_id, arr);
    }
    const rows: { key: TargetKey; label: string; group?: string }[] = [];
    for (const p of products as any[]) {
      if (p.product_type === "variable") {
        const vs = varsByProduct.get(p.id) ?? [];
        if (vs.length === 0) continue;
        for (const v of vs) {
          rows.push({
            key: `v:${p.id}:${v.id}`,
            label: `${p.name} — ${v.name} (stock: ${Number(v.stock ?? 0)})`,
          });
        }
      } else {
        rows.push({
          key: `p:${p.id}`,
          label: `${p.name} (stock: ${Number(p.stock ?? 0)})`,
        });
      }
    }
    return rows;
  }, [products, variations]);

  const parsed = useMemo(() => {
    if (!target) return null;
    const [kind, productId, variationId] = target.split(":");
    return { productId, variationId: kind === "v" ? variationId : null };
  }, [target]);

  const createM = useMutation({
    mutationFn: () => createFn({
      data: {
        product_id: parsed!.productId,
        variation_id: parsed!.variationId,
        quantity: Number(quantity),
        reason,
        note: note || null,
      },
    }),
    onSuccess: () => {
      toast.success("Stock adjusted");
      qc.invalidateQueries({ queryKey: ["stock-adjustments"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-all-variations"] });
      setQuantity(""); setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Adjustment reverted");
      qc.invalidateQueries({ queryKey: ["stock-adjustments"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-all-variations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = !!parsed && quantity !== "" && Number(quantity) !== 0;

  const rows = adjustments as any[];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Stock adjustments</h2>

      <div className="rounded-2xl border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">New adjustment</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Product / Variation</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Select item…</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Quantity change (use negative to reduce)</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 50 or -3" />
          </div>
          <div>
            <Label>Reason</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="initial">Initial stock</option>
              <option value="recount">Recount</option>
              <option value="damage">Damage / Loss</option>
              <option value="return">Return</option>
              <option value="correction">Correction</option>
              <option value="manual">Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
          </div>
        </div>
        <div className="mt-4">
          <Button disabled={!canSubmit || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? "Saving…" : "Apply adjustment"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Variation</th>
              <th className="px-4 py-3">Change</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{r.product?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.variation?.name ?? "—"}</td>
                <td className={`px-4 py-3 font-semibold ${r.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {r.quantity > 0 ? `+${r.quantity}` : r.quantity}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.reason}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.note ?? ""}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => confirm("Revert this adjustment? Stock will be reversed.") && deleteM.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No adjustments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
