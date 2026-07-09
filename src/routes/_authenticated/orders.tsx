import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOrders } from "@/lib/orders.functions";
import { ArrowLeft, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My Orders — Tokyohalal" }] }),
  component: OrdersPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

function OrdersPage() {
  const fn = useServerFn(listMyOrders);
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/profile" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o: any) => (
            <li key={o.id} className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">#{o.id.slice(0, 8)}</p>
                  <p className="text-sm font-semibold">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[o.status] ?? ""}`}>
                  {o.status}
                </span>
              </div>
              <ul className="space-y-1 text-sm">
                {(o.order_items ?? []).map((it: any) => (
                  <li key={it.id} className="flex justify-between">
                    <span>{it.name} × {it.qty}</span>
                    <span className="text-muted-foreground">${(it.price * it.qty).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t pt-3 text-sm font-bold">
                <span>Total</span>
                <span>${Number(o.total).toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
