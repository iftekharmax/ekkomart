import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPurchaseReturns, deletePurchaseReturn } from "@/lib/purchase-returns.functions";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Eye, Undo2 } from "lucide-react";
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
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-purchase-returns"],
    queryFn: () => listFn(),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Return deleted (stock restored)");
      qc.invalidateQueries({ queryKey: ["admin-purchase-returns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
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

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
          ))
        ) : (rows as any[]).length === 0 ? (
          <EmptyState onNew={() => navigate({ to: "/admin/purchase-returns/new" })} />
        ) : (rows as any[]).map((r) => {
          const items = (r.items ?? []) as any[];
          const qty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
          return (
            <div key={r.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{r.reference}</div>
                  <div className="truncate text-sm font-semibold">{r.supplier?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.return_date}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link to="/admin/purchase-returns/$id" params={{ id: r.id }}>
                    <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (confirm("Delete return? Stock will be restored.")) del.mutate(r.id);
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
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">Invoice</th>
              <th className="px-4 py-3 font-semibold">Products</th>
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
            ) : (rows as any[]).length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12"><EmptyState onNew={() => navigate({ to: "/admin/purchase-returns/new" })} /></td></tr>
            ) : (rows as any[]).map((r) => {
              const items = (r.items ?? []) as any[];
              const qty = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-3">{r.return_date}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.reference}</td>
                  <td className="px-4 py-3">{r.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.purchase?.reference ?? "—"}</td>
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
                  <td className="px-4 py-3 text-right">{qty}</td>
                  <td className="px-4 py-3 text-right font-semibold">${Number(r.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to="/admin/purchase-returns/$id" params={{ id: r.id }}>
                        <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => {
                        if (confirm("Delete return? Stock will be restored.")) del.mutate(r.id);
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

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
        <Undo2 className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold">No purchase returns yet</p>
        <p className="text-sm text-muted-foreground">Return goods to a supplier to reduce stock.</p>
      </div>
      <Button size="sm" onClick={onNew}><Plus className="mr-1 h-4 w-4" /> New return</Button>
    </div>
  );
}
