import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllOrders, updateOrderStatus } from "@/lib/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrders,
});

const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

function AdminOrders() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllOrders);
  const updateFn = useServerFn(updateOrderStatus);

  const { data: orders = [] } = useQuery({ queryKey: ["admin-orders"], queryFn: () => listFn() });

  const m = useMutation({
    mutationFn: (v: { id: string; status: (typeof STATUSES)[number] }) => updateFn({ data: v }),
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Orders</h2>
      {orders.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(orders as any[]).map((o) => (
                <tr key={o.id} className="border-t align-top">
                  <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5 text-xs">
                      {(o.order_items ?? []).map((it: any) => (
                        <li key={it.id}>{it.name} × {it.qty}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 font-semibold">${Number(o.total).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) => m.mutate({ id: o.id, status: e.target.value as (typeof STATUSES)[number] })}
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
