import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPurchases, deletePurchase } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/purchases/")({
  head: () => ({ meta: [{ title: "Purchases — Admin" }] }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listPurchases);
  const delFn = useServerFn(deletePurchase);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-purchases"], queryFn: () => listFn() });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Purchase deleted (stock reversed)");
      qc.invalidateQueries({ queryKey: ["admin-purchases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchases</h2>
          <p className="text-sm text-muted-foreground">Record supplier purchases — stock updates automatically.</p>
        </div>
        <Button onClick={() => navigate({ to: "/admin/purchases/new" })}>
          <Plus className="mr-2 h-4 w-4" /> New purchase
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Invoice No.</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">Products</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">Paid</th>
              <th className="px-4 py-3 text-right font-semibold">Due</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : (rows as any[]).length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No purchases yet.</td></tr>
            ) : (rows as any[]).map((p) => {
              const due = Math.max(0, Number(p.total) - Number(p.paid ?? 0));
              const items = (p.items ?? []) as any[];
              const totalQty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
              return (
              <tr key={p.id} className="border-t align-top">
                <td className="px-4 py-3">{p.purchase_date}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                <td className="px-4 py-3">{p.supplier?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {items.length === 0 ? "—" : (
                    <ul className="space-y-0.5">
                      {items.map((it) => (
                        <li key={it.id} className="text-xs">
                          {it.product?.name ?? "—"}
                          {it.variation?.name ? <span className="text-muted-foreground"> · {it.variation.name}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{totalQty}</td>
                <td className="px-4 py-3 text-right font-semibold">${Number(p.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">${Number(p.paid ?? 0).toFixed(2)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${due > 0 ? "text-destructive" : "text-green-600"}`}>${due.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Link to="/admin/purchases/$id" params={{ id: p.id }}>
                      <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="sm" variant="outline" onClick={() => {
                      if (confirm("Delete purchase? Stock will be decreased.")) del.mutate(p.id);
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
