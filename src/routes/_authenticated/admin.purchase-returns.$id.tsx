import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPurchaseReturn, deletePurchaseReturn } from "@/lib/purchase-returns.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/purchase-returns/$id")({
  head: () => ({ meta: [{ title: "Purchase Return — Admin" }] }),
  component: ReturnDetailPage,
});

function ReturnDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getPurchaseReturn);
  const delFn = useServerFn(deletePurchaseReturn);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-purchase-return", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Return deleted (stock restored)");
      qc.invalidateQueries({ queryKey: ["admin-purchase-returns"] });
      navigate({ to: "/admin/purchase-returns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted/40" />;
  if (!data) return <div>Not found</div>;

  const { header, items } = data as any;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link to="/admin/purchase-returns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Button variant="outline" size="sm" onClick={() => {
          if (confirm("Delete return? Stock will be restored.")) del.mutate();
        }}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="font-mono text-xs text-muted-foreground">{header.reference}</div>
        <h2 className="text-xl font-bold">{header.supplier?.name ?? "—"}</h2>
        <div className="mt-1 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div><div className="text-muted-foreground">Date</div><div className="font-medium">{header.return_date}</div></div>
          <div><div className="text-muted-foreground">Invoice</div><div className="font-mono text-xs">{header.purchase?.reference ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Status</div><div className="font-medium">{header.status}</div></div>
          <div><div className="text-muted-foreground">Total</div><div className="font-semibold">${Number(header.total).toFixed(2)}</div></div>
        </div>
        {header.reason && (
          <div className="mt-3 border-t pt-3 text-sm">
            <div className="text-xs text-muted-foreground">Reason</div>
            <div>{header.reason}</div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mt-4 rounded-xl border bg-card">
        <div className="border-b px-4 py-3 font-semibold">Items ({items.length})</div>

        {/* Mobile */}
        <div className="space-y-2 p-3 md:hidden">
          {items.map((it: any) => (
            <div key={it.id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">
                {it.product?.name ?? "—"}
                {it.variation?.name ? <span className="text-muted-foreground"> · {it.variation.name}</span> : null}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-muted-foreground">Qty</div><div className="font-semibold">{it.quantity}</div></div>
                <div><div className="text-muted-foreground">Unit cost</div><div className="font-semibold">${Number(it.unit_cost).toFixed(2)}</div></div>
                <div><div className="text-muted-foreground">Total</div><div className="font-semibold">${Number(it.line_total).toFixed(2)}</div></div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Unit cost</th>
                <th className="px-4 py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => (
                <tr key={it.id} className="border-t">
                  <td className="px-4 py-2">
                    {it.product?.name ?? "—"}
                    {it.variation?.name ? <span className="text-muted-foreground"> · {it.variation.name}</span> : null}
                  </td>
                  <td className="px-4 py-2 text-right">{it.quantity}</td>
                  <td className="px-4 py-2 text-right">${Number(it.unit_cost).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold">${Number(it.line_total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
